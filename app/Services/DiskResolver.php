<?php

namespace App\Services;

use App\Models\Connection;
use App\Models\User;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Resolves a disk key (?disk=) to a concrete Flysystem filesystem. `local`
 * maps to the built-in disk; `conn_{id}` builds a remote adapter on the fly
 * from the owning user's encrypted connection.
 */
class DiskResolver
{
    public function __construct(private readonly UserStorage $storage) {}

    /**
     * @return array{key: string, label: string, type: string, isLocal: bool, filesystem: Filesystem}
     */
    public function resolve(?string $key, User $user): array
    {
        if ($key === null || $key === '' || $key === 'local') {
            return [
                'key' => 'local',
                'label' => 'Local',
                'type' => 'local',
                'isLocal' => true,
                'filesystem' => $this->storage->local($user->id),
            ];
        }

        $connection = $this->connectionFor($key, $user);

        return [
            'key' => $connection->diskKey(),
            'label' => $connection->name,
            'type' => $connection->type,
            'isLocal' => false,
            'filesystem' => Storage::build($this->config($connection->type, $connection->config)),
        ];
    }

    /** The disks a user can browse (local + their connections). */
    public function available(User $user): array
    {
        $disks = [['key' => 'local', 'label' => 'Local', 'type' => 'local']];

        foreach (Connection::where('user_id', $user->id)->orderBy('name')->get() as $c) {
            $disks[] = ['key' => $c->diskKey(), 'label' => $c->name, 'type' => $c->type];
        }

        return $disks;
    }

    /** Load the connection behind a conn_{id} key, scoped to the user. */
    public function connectionFor(string $key, User $user): Connection
    {
        if (! str_starts_with($key, 'conn_')) {
            throw new HttpException(404, 'Unknown disk.');
        }

        return Connection::where('id', (int) substr($key, 5))
            ->where('user_id', $user->id)
            ->firstOr(fn () => throw new HttpException(404, 'Connection not found.'));
    }

    /**
     * Build a Laravel filesystem config array from a connection's stored config.
     *
     * @param  array<string, mixed>  $c
     * @return array<string, mixed>
     */
    public function config(string $type, array $c): array
    {
        return match ($type) {
            // SFTP/FTP: default root to '/' so relative subpaths resolve from the
            // server root (an empty root breaks navigation into subdirectories).
            'sftp' => array_filter([
                'driver' => 'sftp',
                'host' => $c['host'] ?? '',
                'port' => (int) ($c['port'] ?? 22),
                'username' => $c['username'] ?? '',
                'password' => $c['password'] ?? null,
                'privateKey' => $c['privateKey'] ?? null,
                'passphrase' => $c['passphrase'] ?? null,
                'root' => ($c['root'] ?? '') ?: '/',
                'timeout' => 20,
            ], fn ($v) => $v !== null && $v !== ''),
            'ftp' => array_filter([
                'driver' => 'ftp',
                'host' => $c['host'] ?? '',
                'port' => (int) ($c['port'] ?? 21),
                'username' => $c['username'] ?? '',
                'password' => $c['password'] ?? '',
                'root' => ($c['root'] ?? '') ?: '/',
                'ssl' => (bool) ($c['ssl'] ?? false),
                'passive' => true,
                'timeout' => 20,
            ], fn ($v) => $v !== null && $v !== ''),
            's3' => array_filter([
                'driver' => 's3',
                'key' => $c['key'] ?? '',
                'secret' => $c['secret'] ?? '',
                'region' => $c['region'] ?? 'us-east-1',
                'bucket' => $c['bucket'] ?? '',
                'endpoint' => $c['endpoint'] ?? null,
                'use_path_style_endpoint' => (bool) ($c['path_style'] ?? false),
                'root' => $c['root'] ?? '',
            ], fn ($v) => $v !== null && $v !== ''),
            default => throw new HttpException(422, 'Unsupported connection type.'),
        };
    }
}
