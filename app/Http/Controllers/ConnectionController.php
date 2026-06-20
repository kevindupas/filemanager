<?php

namespace App\Http\Controllers;

use App\Models\Connection;
use App\Services\DiskResolver;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Per-user remote storage connections (SFTP / FTP / S3). Credentials are
 * stored encrypted; only the owner can read, use, edit or delete them.
 */
class ConnectionController extends Controller
{
    public function __construct(private readonly DiskResolver $disks) {}

    public function index(Request $request): Response
    {
        $connections = Connection::where('user_id', $request->user()->id)
            ->orderBy('name')
            ->get()
            ->map(fn (Connection $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'type' => $c->type,
                'summary' => $this->summary($c),
            ]);

        return Inertia::render('connections/index', ['connections' => $connections]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateConnection($request);

        $connection = Connection::create([
            'user_id' => $request->user()->id,
            'name' => $data['name'],
            'type' => $data['type'],
            'config' => $data['config'],
        ]);

        Audit::log('connection-created', "Added {$data['type']} connection “{$connection->name}”");

        return back()->with('success', 'Connection saved.');
    }

    public function update(Request $request, Connection $connection): RedirectResponse
    {
        $this->authorizeOwner($request, $connection);
        $data = $this->validateConnection($request);

        // Keep existing secrets if a field was left blank on edit.
        $config = array_merge($connection->config, array_filter($data['config'], fn ($v) => $v !== null && $v !== ''));

        $connection->update(['name' => $data['name'], 'type' => $data['type'], 'config' => $config]);
        Audit::log('connection-updated', "Updated connection “{$connection->name}”");

        return back()->with('success', 'Connection updated.');
    }

    public function destroy(Request $request, Connection $connection): RedirectResponse
    {
        $this->authorizeOwner($request, $connection);
        $name = $connection->name;
        $connection->delete();
        Audit::log('connection-deleted', "Removed connection “{$name}”");

        return back()->with('success', 'Connection removed.');
    }

    /** Test connectivity for a posted config. */
    public function test(Request $request): JsonResponse
    {
        $data = $this->validateConnection($request);

        try {
            $fs = Storage::build($this->disks->config($data['type'], $data['config']));
            $fs->directories(''); // forces a real connection + auth

            return response()->json(['ok' => true]);
        } catch (\Throwable $e) {
            return response()->json(['ok' => false, 'error' => class_basename($e).': '.$e->getMessage()]);
        }
    }

    /** Live connectivity check for a stored connection (drives the status badge). */
    public function health(Request $request, Connection $connection): JsonResponse
    {
        $this->authorizeOwner($request, $connection);

        try {
            $resolved = $this->disks->resolve($connection->diskKey(), $request->user());
            $resolved['filesystem']->directories(''); // real connect + auth

            return response()->json(['online' => true]);
        } catch (\Throwable $e) {
            return response()->json(['online' => false, 'error' => class_basename($e)]);
        }
    }

    /**
     * @return array{name: string, type: string, config: array<string, mixed>}
     */
    private function validateConnection(Request $request): array
    {
        $base = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:sftp,ftp,s3'],
            'config' => ['required', 'array'],
        ]);

        $rules = match ($base['type']) {
            'sftp' => [
                'config.host' => ['required', 'string'],
                'config.port' => ['nullable', 'integer'],
                'config.username' => ['required', 'string'],
                'config.password' => ['nullable', 'string'],
                'config.privateKey' => ['nullable', 'string'],
                'config.passphrase' => ['nullable', 'string'],
                'config.root' => ['nullable', 'string'],
            ],
            'ftp' => [
                'config.host' => ['required', 'string'],
                'config.port' => ['nullable', 'integer'],
                'config.username' => ['required', 'string'],
                'config.password' => ['nullable', 'string'],
                'config.root' => ['nullable', 'string'],
                'config.ssl' => ['nullable', 'boolean'],
            ],
            's3' => [
                'config.key' => ['required', 'string'],
                'config.secret' => ['nullable', 'string'],
                'config.region' => ['nullable', 'string'],
                'config.bucket' => ['required', 'string'],
                'config.endpoint' => ['nullable', 'string'],
                'config.path_style' => ['nullable', 'boolean'],
                'config.root' => ['nullable', 'string'],
            ],
            default => [],
        };

        $request->validate($rules);

        return [
            'name' => $base['name'],
            'type' => $base['type'],
            'config' => $request->input('config', []),
        ];
    }

    private function authorizeOwner(Request $request, Connection $connection): void
    {
        abort_unless($connection->user_id === $request->user()->id, 403);
    }

    private function summary(Connection $c): string
    {
        return match ($c->type) {
            's3' => ($c->config['bucket'] ?? '').' @ '.($c->config['region'] ?? ''),
            default => ($c->config['username'] ?? '').'@'.($c->config['host'] ?? '').':'.($c->config['port'] ?? ''),
        };
    }
}
