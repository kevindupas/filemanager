<?php

namespace App\Services;

use App\Models\FileVersion;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;

/**
 * File version history. Snapshots are stored under the owner's hidden
 * `.versions/` area (so they're never browsable but DO count toward quota),
 * and indexed in file_versions. Older versions are pruned past the cap.
 */
class VersionManager
{
    private const DIR = '.versions';

    /** Snapshot the current bytes at $path (if any) before it is overwritten. */
    public function snapshot(Filesystem $disk, int $ownerId, string $path): void
    {
        if (! $disk->exists($path)) {
            return;
        }

        $key = (string) Str::uuid();
        $disk->writeStream(self::DIR.'/'.$key, $disk->readStream($path));

        FileVersion::create([
            'owner_id' => $ownerId,
            'path' => $path,
            'storage_key' => $key,
            'size' => $disk->size($path),
        ]);

        $this->prune($disk, $ownerId, $path);
    }

    /** @return Collection<int, FileVersion> */
    public function list(int $ownerId, string $path)
    {
        return FileVersion::where('owner_id', $ownerId)->where('path', $path)->orderByDesc('id')->get();
    }

    /** Restore a version: snapshot the current bytes first, then write it back. */
    public function restore(Filesystem $disk, int $ownerId, FileVersion $version): void
    {
        $this->snapshot($disk, $ownerId, $version->path);
        $disk->writeStream($version->path, $disk->readStream(self::DIR.'/'.$version->storage_key));
    }

    public function storagePath(FileVersion $version): string
    {
        return self::DIR.'/'.$version->storage_key;
    }

    /** Keep only the newest N versions of a file. */
    private function prune(Filesystem $disk, int $ownerId, string $path): void
    {
        $cap = max(1, (int) config('filemanager.max_versions', 20));

        $stale = FileVersion::where('owner_id', $ownerId)
            ->where('path', $path)
            ->orderByDesc('id')
            ->skip($cap)
            ->take(1000)
            ->get();

        foreach ($stale as $version) {
            $disk->delete(self::DIR.'/'.$version->storage_key);
            $version->delete();
        }
    }
}
