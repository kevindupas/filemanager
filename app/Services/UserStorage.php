<?php

namespace App\Services;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Per-user storage partitions. Every account is confined to its own
 * subdirectory (`users/{id}`) under the base `local` / `trash` disks, so one
 * user can never see or touch another user's files. The base disks stay
 * configurable/fakeable; this only nests a per-user root beneath them.
 */
class UserStorage
{
    /** The browsable file partition for a user. */
    public function local(int $userId): Filesystem
    {
        return $this->partition('local', $userId);
    }

    /** The recycle-bin partition for a user. */
    public function trash(int $userId): Filesystem
    {
        return $this->partition('trash', $userId);
    }

    /**
     * Build a local filesystem rooted at base/{disk}/users/{id}, creating the
     * directory so realpath-based confinement checks resolve for new accounts.
     */
    private function partition(string $base, int $userId): Filesystem
    {
        if ($userId <= 0) {
            throw new HttpException(403, 'No user context for storage.');
        }

        $root = Storage::disk($base)->path('users/'.$userId);

        if (! is_dir($root)) {
            @mkdir($root, 0775, true);
        }

        return Storage::build([
            'driver' => 'local',
            'root' => $root,
            'throw' => false,
        ]);
    }
}
