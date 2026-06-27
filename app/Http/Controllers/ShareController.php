<?php

namespace App\Http\Controllers;

use App\Models\FileShare;
use App\Services\FileManager;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Authenticated management of public share links (permission: share-files).
 * The public access side lives in PublicShareController.
 */
class ShareController extends Controller
{
    public function __construct(private readonly FileManager $files) {}

    /** Management page listing the current user's own shares. */
    public function index(Request $request): Response
    {
        return Inertia::render('shares/index', [
            'shares' => FileShare::with('creator')
                ->where('created_by', $request->user()->id)
                ->latest()
                ->get()
                ->map($this->present(...)),
        ]);
    }

    /** Shares for a single file (used by the in-browser Share dialog). */
    public function forPath(Request $request): JsonResponse
    {
        $path = $this->files->normalize($request->query('path'));

        return response()->json(
            FileShare::where('path', $path)
                ->where('created_by', $request->user()->id)
                ->latest()
                ->get()
                ->map($this->present(...))
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['required', 'string'],
            'expires_in_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'password' => ['nullable', 'string', 'min:1', 'max:255'],
        ]);

        $path = $this->files->normalize($data['path']);
        $disk = $this->files->disk();

        if ($path === '' || ! $disk->exists($path) || $this->files->isDirectory($path)) {
            throw new HttpException(422, 'Only existing files can be shared.');
        }
        $this->files->absolutePath($path);

        $share = FileShare::create([
            'token' => Str::random(48),
            'path' => $path,
            'name' => basename($path),
            'password' => isset($data['password']) ? Hash::make($data['password']) : null,
            'expires_at' => isset($data['expires_in_days']) ? now()->addDays($data['expires_in_days']) : null,
            'created_by' => $request->user()->id,
        ]);

        Audit::log('shared', "Created share link for “{$share->name}”", ['path' => $path]);

        return response()->json($this->present($share), 201);
    }

    public function destroy(Request $request, FileShare $share): JsonResponse
    {
        abort_unless($share->created_by === $request->user()->id, 403);

        Audit::log('unshared', "Revoked share link for “{$share->name}”");
        $share->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Shape a share for the front end (never exposes the password hash).
     */
    private function present(FileShare $share): array
    {
        return [
            'id' => $share->id,
            'name' => $share->name,
            'path' => $share->path,
            'url' => url('/s/'.$share->token),
            'has_password' => $share->hasPassword(),
            'expires_at' => $share->expires_at?->toDateTimeString(),
            'expired' => $share->isExpired(),
            'downloads' => $share->downloads,
            'last_accessed_at' => $share->last_accessed_at?->toDateTimeString(),
            'created_by' => $share->creator?->name,
        ];
    }
}
