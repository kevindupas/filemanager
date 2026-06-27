<?php

namespace App\Services;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * All file operations are confined to the root of the `local` disk
 * (storage/app/private). Every incoming path is normalised so that
 * "../" sequences can never escape the root, and existing targets are
 * additionally checked against the resolved root (defends against symlinks).
 */
class FileManager
{
    private ?Filesystem $active = null;

    private bool $isLocal = true;

    public function __construct(private readonly UserStorage $storage) {}

    /** Point the manager at a resolved disk (defaults to local). */
    public function useDisk(Filesystem $disk, bool $isLocal): void
    {
        $this->active = $disk;
        $this->isLocal = $isLocal;
    }

    public function isLocal(): bool
    {
        return $this->isLocal;
    }

    /**
     * The active disk, or — when none was set explicitly — the authenticated
     * user's private partition. Never falls back to a shared root, so a missing
     * user context throws rather than leaking everyone's files.
     */
    public function disk(): Filesystem
    {
        return $this->active ?? $this->storage->local((int) auth()->id());
    }

    /** lastModified that tolerates adapters which can't report it (SFTP dirs, S3). */
    private function safeModified(Filesystem $disk, string $path): int
    {
        try {
            return $disk->lastModified($path);
        } catch (\Throwable) {
            return 0;
        }
    }

    /** size that tolerates adapters which can't report it. */
    private function safeSize(Filesystem $disk, string $path): int
    {
        try {
            return $disk->size($path);
        } catch (\Throwable) {
            return 0;
        }
    }

    /**
     * Normalise a client-supplied path to a safe relative path under the
     * disk root. Strips empty/"." segments and resolves ".." without ever
     * going above the root.
     */
    public function normalize(?string $path): string
    {
        $path = str_replace('\\', '/', (string) $path);

        if (str_contains($path, "\0")) {
            throw new HttpException(400, 'Invalid path.');
        }

        $segments = [];
        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }
            if ($segment === '..') {
                array_pop($segments); // can't escape: popping an empty stack stays at root

                continue;
            }
            $segments[] = $segment;
        }

        return implode('/', $segments);
    }

    /**
     * Assert a path stays under the disk root. On the local disk this resolves
     * realpath (defends against symlinks). Remote disks are rooted by their
     * adapter, so normalize() is the confinement guarantee there.
     *
     * Returns the absolute path on local, '' on remote.
     */
    public function absolutePath(string $relative, bool $mustExist = true): string
    {
        if (! $this->isLocal) {
            return '';
        }

        $root = realpath($this->disk()->path(''));
        $full = $this->disk()->path($relative);

        $resolved = realpath($mustExist ? $full : (dirname($full) ?: $root));

        if ($resolved === false || ! str_starts_with($resolved.DIRECTORY_SEPARATOR, $root.DIRECTORY_SEPARATOR)) {
            throw new HttpException(403, 'Path is outside the allowed root.');
        }

        return $full;
    }

    /**
     * List the directories and files directly under $relative.
     *
     * @return array{path: string, breadcrumbs: array<int, array{name: string, path: string}>, entries: array<int, array<string, mixed>>}
     */
    public function list(string $relative): array
    {
        $disk = $this->disk();

        if ($relative !== '' && ! $disk->exists($relative) && ! $this->isDirOn($disk, $relative)) {
            throw new HttpException(404, 'Folder not found.');
        }

        // Hidden files/folders (dotfiles like Laravel's .gitignore) are not shown.
        $isVisible = fn (string $p) => ! str_starts_with(basename($p), '.');

        $directories = collect($disk->directories($relative))
            ->filter($isVisible)
            ->map(fn (string $dir) => [
                'name' => basename($dir),
                'path' => $dir,
                'type' => 'dir',
                'size' => null,
                'modified' => $this->safeModified($disk, $dir),
                'extension' => null,
            ]);

        $files = collect($disk->files($relative))
            ->filter($isVisible)
            ->map(fn (string $file) => [
                'name' => basename($file),
                'path' => $file,
                'type' => 'file',
                'size' => $this->safeSize($disk, $file),
                'modified' => $this->safeModified($disk, $file),
                'extension' => strtolower(pathinfo($file, PATHINFO_EXTENSION)),
            ]);

        $entries = $directories
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->concat($files->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE))
            ->values()
            ->all();

        return [
            'path' => $relative,
            'breadcrumbs' => $this->breadcrumbs($relative),
            'entries' => $entries,
        ];
    }

    /**
     * Aggregate stats across the whole disk: file count, folder count, and
     * total bytes used. Walks the tree recursively (fine for a personal,
     * low-volume server).
     *
     * @return array{files: int, folders: int, bytes: int, recent: array<int, array<string, mixed>>}
     */
    public function stats(): array
    {
        $disk = $this->disk();
        $files = $disk->allFiles('');
        $folders = $disk->allDirectories('');

        $bytes = 0;
        $withMeta = [];
        foreach ($files as $file) {
            $size = $disk->size($file);
            $bytes += $size;
            $withMeta[] = [
                'name' => basename($file),
                'path' => $file,
                'type' => 'file',
                'size' => $size,
                'modified' => $disk->lastModified($file),
                'extension' => strtolower(pathinfo($file, PATHINFO_EXTENSION)),
            ];
        }

        // Five most recently modified files.
        usort($withMeta, fn ($a, $b) => $b['modified'] <=> $a['modified']);

        return [
            'files' => count($files),
            'folders' => count($folders),
            'bytes' => $bytes,
            'recent' => array_slice($withMeta, 0, 5),
        ];
    }

    /** Files up to this size get a SHA-256 checksum (avoids hashing huge files). */
    private const HASH_LIMIT = 200 * 1024 * 1024; // 200 MB

    /**
     * Detailed metadata for a single file or folder.
     *
     * @return array<string, mixed>
     */
    public function info(string $relative): array
    {
        $disk = $this->disk();

        if ($relative === '' || (! $disk->exists($relative) && ! $this->isDirOn($disk, $relative))) {
            throw new HttpException(404, 'Item not found.');
        }
        $abs = $this->absolutePath($relative); // asserts under root

        $isDir = in_array(
            $relative,
            $disk->directories(dirname($relative) === '.' ? '' : dirname($relative)),
            true,
        );

        $info = [
            'name' => basename($relative),
            'path' => $relative,
            'type' => $isDir ? 'dir' : 'file',
            'modified' => $this->safeModified($disk, $relative),
        ];

        // Local filesystem extras (perms/created/checksum) don't exist on remote.
        if ($this->isLocal) {
            $info['created'] = @filectime($abs) ?: null;
            $info['permissions'] = substr(sprintf('%o', @fileperms($abs) ?: 0), -4);
            $info['readable'] = is_readable($abs);
            $info['writable'] = is_writable($abs);
        }

        if ($isDir) {
            $files = $disk->allFiles($relative);
            $info['fileCount'] = count($files);
            $info['folderCount'] = count($disk->allDirectories($relative));
            $info['size'] = array_sum(array_map(fn ($f) => $this->safeSize($disk, $f), $files));

            return $info;
        }

        $info['size'] = $this->safeSize($disk, $relative);
        $info['mime'] = $disk->mimeType($relative) ?: 'application/octet-stream';
        $info['extension'] = strtolower(pathinfo($relative, PATHINFO_EXTENSION));

        if ($this->isLocal) {
            $dimensions = @getimagesize($abs);
            if ($dimensions !== false) {
                $info['image'] = ['width' => $dimensions[0], 'height' => $dimensions[1]];
            }

            if (function_exists('exif_read_data') && in_array($info['extension'], ['jpg', 'jpeg', 'tiff', 'tif'], true)) {
                $exif = @exif_read_data($abs);
                if (is_array($exif)) {
                    $info['exif'] = array_filter([
                        'camera' => trim(($exif['Make'] ?? '').' '.($exif['Model'] ?? '')) ?: null,
                        'taken_at' => $exif['DateTimeOriginal'] ?? ($exif['DateTime'] ?? null),
                        'iso' => $exif['ISOSpeedRatings'] ?? null,
                        'exposure' => $exif['ExposureTime'] ?? null,
                        'aperture' => isset($exif['FNumber']) ? 'f/'.$this->rationalToFloat($exif['FNumber']) : null,
                        'orientation' => $exif['Orientation'] ?? null,
                    ], fn ($v) => $v !== null && $v !== '');
                }
            }

            if ($info['size'] <= self::HASH_LIMIT) {
                $info['sha256'] = hash_file('sha256', $abs);
            }
        }

        return $info;
    }

    /**
     * Safely turn an EXIF rational ("28/10") into a rounded float. Never
     * evaluates the string as code.
     */
    private function rationalToFloat(string $rational): float
    {
        if (str_contains($rational, '/')) {
            [$num, $den] = array_pad(explode('/', $rational, 2), 2, '1');
            $den = (float) $den ?: 1.0;

            return round((float) $num / $den, 1);
        }

        return round((float) $rational, 1);
    }

    /** Total bytes currently stored on the disk. */
    public function usedBytes(): int
    {
        $disk = $this->disk();

        return array_sum(array_map(fn ($f) => $disk->size($f), $disk->allFiles('')));
    }

    /** Configured quota in bytes (0 = unlimited). */
    public function quotaBytes(): int
    {
        return (int) round((float) config('filemanager.quota_gb') * 1024 ** 3);
    }

    /** True if adding $incoming bytes would exceed the quota. */
    public function exceedsQuota(int $incoming): bool
    {
        $limit = $this->quotaBytes();

        return $limit > 0 && $this->usedBytes() + $incoming > $limit;
    }

    /** True if $relative points at an existing directory (root counts). */
    public function isDirectory(string $relative): bool
    {
        return $this->isDirOn($this->disk(), $relative);
    }

    /** isDirectory against an arbitrary disk (used for cross-disk transfers). */
    public function isDirOn(Filesystem $fs, string $relative): bool
    {
        if ($relative === '') {
            return true;
        }
        $parent = dirname($relative) === '.' ? '' : dirname($relative);

        return in_array($relative, $fs->directories($parent), true);
    }

    /**
     * Copy a file or directory tree FROM one disk TO another (streaming).
     */
    public function copyAcross(Filesystem $from, Filesystem $to, string $src, string $target, bool $isDir): void
    {
        if (! $isDir) {
            $stream = $from->readStream($src);
            $to->writeStream($target, $stream);
            if (is_resource($stream)) {
                fclose($stream);
            }

            return;
        }

        $to->makeDirectory($target);
        foreach ($from->allDirectories($src) as $dir) {
            $to->makeDirectory($target.'/'.substr($dir, strlen($src) + 1));
        }
        foreach ($from->allFiles($src) as $file) {
            $stream = $from->readStream($file);
            $to->writeStream($target.'/'.substr($file, strlen($src) + 1), $stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
    }

    /**
     * Move or copy a set of items into a destination folder.
     *
     * @param  array<int, string>  $sources
     * @param  array<string, string>  $resolutions  srcPath => overwrite|keep|skip (for existing targets)
     * @return array{done: int, errors: array<int, string>}
     */
    public function transfer(array $sources, string $destination, bool $copy, array $resolutions = []): array
    {
        $disk = $this->disk();
        $dest = $this->normalize($destination);

        if (! $this->isDirectory($dest)) {
            throw new HttpException(404, 'Destination folder not found.');
        }
        $this->absolutePath($dest);

        $done = 0;
        $errors = [];

        foreach ($sources as $raw) {
            $src = $this->normalize((string) $raw);
            $name = basename($src);

            if ($src === '' || (! $disk->exists($src) && ! $this->isDirOn($disk, $src))) {
                $errors[] = "{$name}: not found";

                continue;
            }
            $this->absolutePath($src);

            $isDir = $this->isDirectory($src);

            // Cannot move/copy a folder into itself or one of its descendants.
            if ($isDir && ($dest === $src || str_starts_with($dest.'/', $src.'/'))) {
                $errors[] = "{$name}: cannot move into itself";

                continue;
            }

            $target = $dest === '' ? $name : $dest.'/'.$name;

            if ($target === $src) {
                continue; // already there — no-op
            }

            if ($disk->exists($target) || $this->isDirOn($disk, $target)) {
                $action = $resolutions[$src] ?? 'keep';
                if ($action === 'skip') {
                    continue;
                }
                if ($action === 'keep') {
                    $target = $this->uniqueName($target);
                } else { // overwrite → clear the existing target first
                    if ($this->isDirOn($disk, $target)) {
                        $disk->deleteDirectory($target);
                    } else {
                        $disk->delete($target);
                    }
                }
            }

            try {
                if ($copy) {
                    $this->copyPath($src, $target, $isDir);
                } else {
                    $disk->move($src, $target);
                }
                $done++;
            } catch (\Throwable) {
                $errors[] = "{$name}: failed";
            }
        }

        return ['done' => $done, 'errors' => $errors];
    }

    /**
     * Recursive substring search on names, starting at $base and going down.
     *
     * @return array{path: string, query: string, truncated: bool, entries: array<int, array<string, mixed>>}
     */
    public function search(string $base, string $query): array
    {
        $disk = $this->disk();
        $base = $this->normalize($base);
        $needle = mb_strtolower(trim($query));
        $limit = 500;

        if ($needle === '' || ($base !== '' && ! $disk->exists($base) && ! $this->isDirOn($disk, $base))) {
            return ['path' => $base, 'query' => $query, 'truncated' => false, 'entries' => []];
        }

        $matches = [];
        $visible = fn (string $p) => ! str_starts_with(basename($p), '.');
        $hit = fn (string $p) => str_contains(mb_strtolower(basename($p)), $needle);

        foreach ($disk->allDirectories($base) as $dir) {
            if (count($matches) >= $limit) {
                break;
            }
            if ($visible($dir) && $hit($dir)) {
                $matches[] = [
                    'name' => basename($dir), 'path' => $dir, 'type' => 'dir',
                    'size' => null, 'modified' => $this->safeModified($disk, $dir), 'extension' => null,
                ];
            }
        }

        foreach ($disk->allFiles($base) as $file) {
            if (count($matches) >= $limit) {
                break;
            }
            if ($visible($file) && $hit($file)) {
                $matches[] = [
                    'name' => basename($file), 'path' => $file, 'type' => 'file',
                    'size' => $this->safeSize($disk, $file), 'modified' => $this->safeModified($disk, $file),
                    'extension' => strtolower(pathinfo($file, PATHINFO_EXTENSION)),
                ];
            }
        }

        return [
            'path' => $base,
            'query' => $query,
            'truncated' => count($matches) >= $limit,
            'entries' => array_slice($matches, 0, $limit),
        ];
    }

    /**
     * Subdirectories of $relative (for the move/copy folder picker).
     *
     * @return array{path: string, breadcrumbs: array<int, array{name: string, path: string}>, dirs: array<int, array{name: string, path: string}>}
     */
    public function subdirectories(string $relative): array
    {
        $disk = $this->disk();

        if ($relative !== '' && ! $disk->exists($relative) && ! $this->isDirOn($disk, $relative)) {
            throw new HttpException(404, 'Folder not found.');
        }

        $dirs = collect($disk->directories($relative))
            ->filter(fn (string $d) => ! str_starts_with(basename($d), '.'))
            ->map(fn (string $d) => ['name' => basename($d), 'path' => $d])
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->all();

        return ['path' => $relative, 'breadcrumbs' => $this->breadcrumbs($relative), 'dirs' => $dirs];
    }

    /** Append " (copy)" / " (copy N)" until the name is free on the active disk. */
    public function uniqueName(string $path): string
    {
        return $this->uniqueNameOn($this->disk(), $path);
    }

    /** uniqueName against an arbitrary disk. */
    public function uniqueNameOn(Filesystem $fs, string $path): string
    {
        $dir = dirname($path) === '.' ? '' : dirname($path);
        $base = pathinfo($path, PATHINFO_FILENAME);
        $ext = pathinfo($path, PATHINFO_EXTENSION);
        $ext = $ext !== '' ? '.'.$ext : '';

        $i = 1;
        do {
            $suffix = $i === 1 ? ' (copy)' : " (copy {$i})";
            $candidate = ($dir === '' ? '' : $dir.'/').$base.$suffix.$ext;
            $i++;
        } while ($fs->exists($candidate));

        return $candidate;
    }

    /** Copy a file, or a directory tree recursively. */
    private function copyPath(string $src, string $target, bool $isDir): void
    {
        $disk = $this->disk();

        if (! $isDir) {
            $disk->copy($src, $target);

            return;
        }

        $disk->makeDirectory($target);
        foreach ($disk->allDirectories($src) as $dir) {
            $disk->makeDirectory($target.'/'.substr($dir, strlen($src) + 1));
        }
        foreach ($disk->allFiles($src) as $file) {
            $disk->copy($file, $target.'/'.substr($file, strlen($src) + 1));
        }
    }

    /**
     * Build breadcrumb segments for the current path (root included).
     *
     * @return array<int, array{name: string, path: string}>
     */
    public function breadcrumbs(string $relative): array
    {
        $crumbs = [['name' => 'Home', 'path' => '']];

        $accumulator = '';
        foreach (array_filter(explode('/', $relative), fn ($s) => $s !== '') as $segment) {
            $accumulator = $accumulator === '' ? $segment : $accumulator.'/'.$segment;
            $crumbs[] = ['name' => $segment, 'path' => $accumulator];
        }

        return $crumbs;
    }
}
