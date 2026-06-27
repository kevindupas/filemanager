<?php

namespace App\Services;

use App\Models\TrashedItem;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Recycle bin. Soft-deletes move items to the owner's `trash` partition
 * (outside the browsable root) and record who deleted them, so each user only
 * ever restores or purges their own items. Trash is local-only and always
 * scoped to an explicit owner id (works in queue jobs with no auth context).
 */
class TrashManager
{
    public function __construct(
        private readonly FileManager $files,
        private readonly UserStorage $storage,
    ) {}

    private function trashDisk(int $userId): Filesystem
    {
        return $this->storage->trash($userId);
    }

    /**
     * Move a file/folder from the owner's local partition into their trash.
     */
    public function trash(string $relative, int $userId): TrashedItem
    {
        $relative = $this->files->normalize($relative);
        $disk = $this->storage->local($userId);

        if ($relative === '' || ! $disk->exists($relative)) {
            throw new HttpException(404, 'Item not found.');
        }
        $this->files->useDisk($disk, true);
        $this->files->absolutePath($relative); // assert under root (symlink defense)

        $isDir = $this->files->isDirectory($relative);
        $size = $isDir
            ? array_sum(array_map(fn ($f) => $disk->size($f), $disk->allFiles($relative)))
            : $disk->size($relative);

        $key = (string) Str::uuid();

        // Same volume → a rename moves both files and directory trees cheaply.
        rename($disk->path($relative), $this->trashDisk($userId)->path($key));

        return TrashedItem::create([
            'original_path' => $relative,
            'name' => basename($relative),
            'type' => $isDir ? 'dir' : 'file',
            'size' => $size,
            'storage_key' => $key,
            'deleted_by' => $userId,
        ]);
    }

    /**
     * Restore an item to its owner's original location (suffixed if taken).
     */
    public function restore(TrashedItem $item): string
    {
        $ownerId = (int) $item->deleted_by;
        $disk = $this->storage->local($ownerId);
        $this->files->useDisk($disk, true);
        $target = $this->files->normalize($item->original_path);

        // Recreate the parent folder if it disappeared while in the trash.
        $parent = dirname($target);
        if ($parent !== '.' && $parent !== '' && ! $disk->exists($parent)) {
            $disk->makeDirectory($parent);
        }

        if ($disk->exists($target)) {
            $target = $this->files->uniqueName($target);
        }

        rename($this->trashDisk($ownerId)->path($item->storage_key), $disk->path($target));
        $item->delete();

        return $target;
    }

    /**
     * Permanently delete one trashed item.
     */
    public function purge(TrashedItem $item): void
    {
        $disk = $this->trashDisk((int) $item->deleted_by);
        $disk->delete($item->storage_key);
        $disk->deleteDirectory($item->storage_key);
        $item->delete();
    }

    /**
     * Purge trashed items older than $days across all users (retention policy).
     * $days <= 0 keeps everything.
     */
    public function purgeExpired(int $days): int
    {
        if ($days <= 0) {
            return 0;
        }

        $count = 0;
        foreach (TrashedItem::where('created_at', '<', now()->subDays($days))->get() as $item) {
            $this->purge($item);
            $count++;
        }

        return $count;
    }

    /**
     * Empty the bin for a single user (never touches other users' trash).
     */
    public function emptyAll(int $userId): int
    {
        $count = 0;
        foreach (TrashedItem::where('deleted_by', $userId)->get() as $item) {
            $this->purge($item);
            $count++;
        }

        return $count;
    }
}
