<?php

namespace App\Services;

use App\Models\FileGrant;
use App\Models\User;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Resolves an internal share grant for a grantee and confines file operations
 * to the granted subtree of the owner's partition. Points the FileManager at
 * the owner's disk so existing file operations can be reused.
 */
class SharedAccess
{
    public function __construct(
        private readonly FileManager $files,
    ) {}

    /** Load a grant addressed to this grantee (404 otherwise). */
    public function grantFor(User $grantee, FileGrant $grant): FileGrant
    {
        if ($grant->grantee_id !== $grantee->id) {
            throw new HttpException(404, 'Share not found.');
        }

        return $grant;
    }

    /**
     * Normalise a requested path and assert it stays within the grant subtree.
     * An empty path resolves to the grant root itself.
     */
    public function pathWithin(FileGrant $grant, ?string $path): string
    {
        $base = $this->files->normalize($grant->path);
        $rel = ($path === null || $path === '') ? $base : $this->files->normalize($path);

        if ($rel !== $base && ! str_starts_with($rel, $base.'/')) {
            throw new HttpException(403, 'Outside the shared scope.');
        }

        return $rel;
    }
}
