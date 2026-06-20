<?php

namespace App\Services;

use App\Models\TrashedItem;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Recycle bin. Soft-deletes move items to the `trash` disk (outside the
 * browsable root) and record where they came from, so they can be restored.
 */
class TrashManager
{
    public function __construct(private readonly FileManager $files) {}

    private function trashDisk()
    {
        return Storage::disk('trash');
    }

    /**
     * Move a file/folder from the local disk into the trash store.
     */
    public function trash(string $relative, ?int $userId): TrashedItem
    {
        $relative = $this->files->normalize($relative);
        $disk = $this->files->disk();

        if ($relative === '' || ! $disk->exists($relative)) {
            throw new HttpException(404, 'Item not found.');
        }
        $this->files->absolutePath($relative); // assert under root

        $isDir = $this->files->isDirectory($relative);
        $size = $isDir
            ? array_sum(array_map(fn ($f) => $disk->size($f), $disk->allFiles($relative)))
            : $disk->size($relative);

        $key = (string) Str::uuid();
        $this->ensureTrashRoot();

        // Same volume → a rename moves both files and directory trees cheaply.
        rename($disk->path($relative), $this->trashDisk()->path($key));

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
     * Restore an item to its original location (suffixed if the name is taken).
     */
    public function restore(TrashedItem $item): string
    {
        $disk = $this->files->disk();
        $target = $this->files->normalize($item->original_path);

        // Recreate the parent folder if it disappeared while in the trash.
        $parent = dirname($target);
        if ($parent !== '.' && $parent !== '' && ! $disk->exists($parent)) {
            $disk->makeDirectory($parent);
        }

        if ($disk->exists($target)) {
            $target = $this->files->uniqueName($target);
        }

        rename($this->trashDisk()->path($item->storage_key), $disk->path($target));
        $item->delete();

        return $target;
    }

    /**
     * Permanently delete one trashed item.
     */
    public function purge(TrashedItem $item): void
    {
        $this->trashDisk()->delete($item->storage_key);
        $this->trashDisk()->deleteDirectory($item->storage_key);
        $item->delete();
    }

    /**
     * Empty the whole bin.
     */
    public function emptyAll(): int
    {
        $count = 0;
        foreach (TrashedItem::all() as $item) {
            $this->purge($item);
            $count++;
        }

        return $count;
    }

    private function ensureTrashRoot(): void
    {
        $root = $this->trashDisk()->path('');
        if (! is_dir($root)) {
            mkdir($root, 0775, true);
        }
    }
}
