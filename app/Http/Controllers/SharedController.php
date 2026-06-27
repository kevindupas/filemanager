<?php

namespace App\Http\Controllers;

use App\Models\FileGrant;
use App\Services\FileManager;
use App\Services\SharedAccess;
use App\Services\UserStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Grantee-side access to files shared with the current user (internal shares).
 * Every operation is confined to the granted subtree of the owner's partition.
 */
class SharedController extends Controller
{
    public function __construct(
        private readonly FileManager $files,
        private readonly SharedAccess $shared,
        private readonly UserStorage $storage,
    ) {}

    /** "Shared with me" — grants addressed to the current user. */
    public function index(Request $request): Response
    {
        $grants = FileGrant::with('owner')
            ->where('grantee_id', $request->user()->id)
            ->latest()
            ->get()
            ->map(fn (FileGrant $g) => [
                'id' => $g->id,
                'owner' => $g->owner?->name,
                'path' => $g->path,
                'name' => basename($g->path) ?: $g->path,
                'permission' => $g->permission,
                'is_dir' => $this->storage->local($g->owner_id)->directoryExists($g->path),
            ]);

        return Inertia::render('shared/index', ['grants' => $grants]);
    }

    public function list(Request $request, FileGrant $grant): JsonResponse
    {
        $path = $this->enter($request, $grant);

        return response()->json($this->files->list($path));
    }

    public function info(Request $request, FileGrant $grant): JsonResponse
    {
        $path = $this->enter($request, $grant);

        return response()->json($this->files->info($path));
    }

    public function download(Request $request, FileGrant $grant): StreamedResponse
    {
        $path = $this->enter($request, $grant);
        $disk = $this->files->disk();

        if ($path === '' || ! $disk->exists($path)) {
            throw new HttpException(404, 'File not found.');
        }

        return response()->streamDownload(function () use ($disk, $path) {
            $stream = $disk->readStream($path);
            while (! feof($stream)) {
                echo fread($stream, 8192);
                flush();
            }
            fclose($stream);
        }, basename($path), [
            'Content-Type' => $disk->mimeType($path) ?: 'application/octet-stream',
            'Content-Length' => (string) $disk->size($path),
        ]);
    }

    public function preview(Request $request, FileGrant $grant): StreamedResponse
    {
        $path = $this->enter($request, $grant);
        $disk = $this->files->disk();

        if ($path === '' || ! $disk->exists($path)) {
            throw new HttpException(404, 'File not found.');
        }

        return response()->stream(function () use ($disk, $path) {
            $stream = $disk->readStream($path);
            while (! feof($stream)) {
                echo fread($stream, 8192);
                flush();
            }
            fclose($stream);
        }, 200, [
            'Content-Type' => $disk->mimeType($path) ?: 'application/octet-stream',
            'Content-Disposition' => 'inline; filename="'.basename($path).'"',
        ]);
    }

    /**
     * Verify the grant belongs to the caller, bind the owner's disk, and return
     * the requested path confined to the grant subtree.
     */
    private function enter(Request $request, FileGrant $grant): string
    {
        $this->shared->grantFor($request->user(), $grant);
        // Bind on THIS controller's FileManager instance (the service is not a
        // singleton, so binding via another instance wouldn't be visible here).
        $this->files->useDisk($this->storage->local($grant->owner_id), true);

        return $this->shared->pathWithin($grant, $request->query('path'));
    }
}
