<?php

namespace App\Jobs;

use App\Models\Transfer;
use App\Services\DiskResolver;
use App\Services\FileManager;
use App\Services\TrashManager;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

/**
 * Runs a cross-disk move/copy in the background, streaming file by file and
 * writing progress (bytes/files done) to the transfers row so the UI can poll.
 */
class ProcessTransfer implements ShouldQueue
{
    use Queueable;

    public int $timeout = 3600; // up to an hour for big transfers

    public int $tries = 1; // never auto-retry: a half-done copy must not restart

    public bool $failOnTimeout = true;

    public function __construct(public int $transferId) {}

    /**
     * Called when the job fails terminally (exception, timeout kill, max attempts).
     * Runs even on SIGKILL-driven failures where handle()'s try/catch is bypassed,
     * so the transfers row never stays stuck on "running".
     */
    public function failed(?\Throwable $e): void
    {
        $t = Transfer::find($this->transferId);
        if ($t && $t->status !== 'done') {
            $t->update(['status' => 'failed', 'error' => $e ? class_basename($e).': '.$e->getMessage() : 'Transfer failed']);
        }
        Cache::forget("transfer:{$this->transferId}");
    }

    public function handle(DiskResolver $disks, FileManager $files, TrashManager $trash): void
    {
        @set_time_limit(0);

        $t = Transfer::find($this->transferId);
        if (! $t) {
            return;
        }

        try {
            $user = $t->user;
            $src = $disks->resolve($t->source_disk, $user);
            $dest = $disks->resolve($t->dest_disk, $user);
            $srcFs = $src['filesystem'];
            $destFs = $dest['filesystem'];
            $destDir = $files->normalize($t->destination);

            // Scan the source ONCE: build a plan + totals (sizes captured here are
            // reused during the copy, so we don't walk/stat the remote disk twice).
            $plan = [];
            $totalBytes = 0;
            $totalFiles = 0;
            foreach ($t->paths as $raw) {
                $p = $files->normalize((string) $raw);
                if ($p === '') {
                    continue;
                }
                $isDir = $files->isDirOn($srcFs, $p);
                if (! $isDir && ! $srcFs->exists($p)) {
                    continue; // source vanished
                }
                $entry = ['src' => $p, 'isDir' => $isDir, 'name' => basename($p), 'dirs' => [], 'files' => []];
                if ($isDir) {
                    foreach ($srcFs->allDirectories($p) as $d) {
                        $entry['dirs'][] = substr($d, strlen($p) + 1);
                    }
                    foreach ($srcFs->allFiles($p) as $f) {
                        $size = $this->size($srcFs, $f);
                        $entry['files'][] = ['src' => $f, 'rel' => substr($f, strlen($p) + 1), 'size' => $size];
                        $totalBytes += $size;
                        $totalFiles++;
                    }
                } else {
                    $size = $this->size($srcFs, $p);
                    $entry['files'][] = ['src' => $p, 'rel' => null, 'size' => $size];
                    $totalBytes += $size;
                    $totalFiles++;
                }
                $plan[] = $entry;
            }
            $t->update(['status' => 'running', 'total_bytes' => $totalBytes, 'total_files' => $totalFiles]);

            // Copy from the plan (+ delete source on move).
            $resolutions = $t->resolutions ?? [];
            $doneBytes = 0;
            $doneFiles = 0;
            foreach ($plan as $entry) {
                $target = $destDir === '' ? $entry['name'] : $destDir.'/'.$entry['name'];
                if ($destFs->exists($target) || $files->isDirOn($destFs, $target)) {
                    $action = $resolutions[$entry['src']] ?? 'keep';
                    if ($action === 'skip') {
                        continue; // leave both — also keeps the source on a move
                    }
                    if ($action === 'keep') {
                        $target = $files->uniqueNameOn($destFs, $target);
                    } elseif ($files->isDirOn($destFs, $target)) {
                        $destFs->deleteDirectory($target); // overwrite: replace cleanly
                    } else {
                        $destFs->delete($target);
                    }
                }

                if ($entry['isDir']) {
                    $destFs->makeDirectory($target);
                    foreach ($entry['dirs'] as $rel) {
                        $destFs->makeDirectory($target.'/'.$rel);
                    }
                    foreach ($entry['files'] as $f) {
                        $this->copyFile($srcFs, $destFs, $f['src'], $target.'/'.$f['rel']);
                        $doneBytes += $f['size'];
                        $doneFiles++;
                        $this->progress($t->id, $doneBytes, $doneFiles, $f['src']);
                    }
                } else {
                    $f = $entry['files'][0];
                    $this->copyFile($srcFs, $destFs, $f['src'], $target);
                    $doneBytes += $f['size'];
                    $doneFiles++;
                    $this->progress($t->id, $doneBytes, $doneFiles, $f['src']);
                }

                if ($t->mode === 'move') {
                    if ($src['isLocal']) {
                        $trash->trash($entry['src'], $user->id);
                    } elseif ($entry['isDir']) {
                        $srcFs->deleteDirectory($entry['src']);
                    } else {
                        $srcFs->delete($entry['src']);
                    }
                }
            }

            $t->update(['status' => 'done', 'current' => null, 'done_bytes' => $totalBytes, 'done_files' => $totalFiles]);
            Cache::forget("transfer:{$t->id}");
        } catch (\Throwable $e) {
            $t->update(['status' => 'failed', 'error' => class_basename($e).': '.$e->getMessage()]);
            Cache::forget("transfer:{$t->id}");
        }
    }

    /** Hot progress counters live in the cache (Redis), not the DB row. */
    private function progress(int $id, int $doneBytes, int $doneFiles, string $current): void
    {
        Cache::put("transfer:{$id}", [
            'done_bytes' => $doneBytes,
            'done_files' => $doneFiles,
            'current' => $current,
        ], now()->addHour());
    }

    /**
     * Stream a file to a temporary name, then rename it onto the final target.
     * The real filename only appears once the bytes are fully written, so a
     * half-transferred file is never visible (and never clobbers an existing one
     * until it's complete).
     */
    private function copyFile(Filesystem $from, Filesystem $to, string $src, string $target): void
    {
        $tmp = $target.'.fmpart-'.substr(md5($target), 0, 8);
        $stream = $from->readStream($src);
        $to->writeStream($tmp, $stream);
        if (is_resource($stream)) {
            fclose($stream);
        }
        if ($to->exists($target)) {
            $to->delete($target); // replace (overwrite within a merged dir)
        }
        $to->move($tmp, $target);
    }

    private function size(Filesystem $fs, string $path): int
    {
        try {
            return $fs->size($path);
        } catch (\Throwable) {
            return 0;
        }
    }
}
