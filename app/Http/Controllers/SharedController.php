<?php

namespace App\Http\Controllers;

use App\Models\FileGrant;
use App\Services\FileManager;
use App\Services\SharedAccess;
use App\Services\TrashManager;
use App\Services\UserStorage;
use App\Services\VersionManager;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Grantee-side access to files shared with the current user (internal shares).
 * Every operation is confined to the granted subtree of the owner's partition;
 * writes require a write grant and are charged to the owner's quota.
 */
class SharedController extends Controller
{
    public function __construct(
        private readonly FileManager $files,
        private readonly SharedAccess $shared,
        private readonly UserStorage $storage,
        private readonly TrashManager $trash,
        private readonly VersionManager $versions,
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
                'owner_id' => $g->owner_id,
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

        return $this->stream($path, attachment: true);
    }

    public function preview(Request $request, FileGrant $grant): StreamedResponse
    {
        $path = $this->enter($request, $grant);

        return $this->stream($path, attachment: false);
    }

    // --- writes (require a write grant) ---

    public function storeFolder(Request $request, FileGrant $grant): RedirectResponse
    {
        $this->bind($request, $grant, write: true);
        $data = $request->validate([
            'path' => ['nullable', 'string'],
            'name' => ['required', 'string', 'max:255', 'regex:/^[^\/\\\\\0]+$/'],
        ]);

        $parent = $this->shared->pathWithin($grant, $data['path'] ?? null);
        $target = $this->confined($grant, $parent.'/'.$data['name']);
        $disk = $this->files->disk();

        if ($disk->exists($target) || $this->files->isDirectory($target)) {
            return back()->withErrors(['name' => 'A file or folder with that name already exists.']);
        }

        $disk->makeDirectory($target);
        Audit::log('shared-created-folder', "Created “{$data['name']}” in a shared folder", ['path' => $target]);

        return back()->with('success', 'Folder created.');
    }

    public function upload(Request $request, FileGrant $grant): JsonResponse
    {
        $this->bind($request, $grant, write: true);
        $request->validate([
            'path' => ['nullable', 'string'],
            'file' => ['required', 'file'],
        ]);

        $dir = $this->shared->pathWithin($grant, $request->input('path'));
        $file = $request->file('file');
        $size = (int) $file->getSize();

        $limit = $grant->owner->effectiveQuotaBytes();
        if ($limit > 0 && $this->files->usedBytes() + $size > $limit) {
            return response()->json(['error' => "The owner's storage quota is full."], 422);
        }

        $name = basename($this->files->normalize($file->getClientOriginalName())) ?: 'upload';
        $target = $this->confined($grant, ($dir === '' ? '' : $dir.'/').$name);

        if ($this->files->disk()->exists($target)) {
            $this->versions->snapshot($this->files->disk(), $grant->owner_id, $target);
        }

        $stream = fopen($file->getPathname(), 'rb');
        $this->files->disk()->writeStream($target, $stream);
        if (is_resource($stream)) {
            fclose($stream);
        }
        Audit::log('shared-uploaded', "Uploaded “{$name}” to a shared folder", ['path' => $target]);

        return response()->json(['ok' => true]);
    }

    public function rename(Request $request, FileGrant $grant): RedirectResponse
    {
        $this->bind($request, $grant, write: true);
        $data = $request->validate([
            'path' => ['required', 'string'],
            'name' => ['required', 'string', 'max:255', 'regex:/^[^\/\\\\\0]+$/'],
        ]);

        $source = $this->shared->pathWithin($grant, $data['path']);
        $disk = $this->files->disk();

        if ($source === '' || (! $disk->exists($source) && ! $this->files->isDirectory($source))) {
            throw new HttpException(404, 'Item not found.');
        }

        $directory = trim(dirname($source), '.');
        $target = $this->confined($grant, ($directory === '' ? '' : $directory.'/').$data['name']);

        if ($disk->exists($target) || $this->files->isDirectory($target)) {
            return back()->withErrors(['name' => 'A file or folder with that name already exists.']);
        }

        $disk->move($source, $target);
        Audit::log('shared-renamed', 'Renamed in a shared folder', ['from' => $source, 'to' => $target]);

        return back()->with('success', 'Renamed.');
    }

    public function destroy(Request $request, FileGrant $grant): JsonResponse
    {
        $this->bind($request, $grant, write: true);
        $data = $request->validate(['path' => ['required', 'string']]);

        $path = $this->shared->pathWithin($grant, $data['path']);
        // Soft-delete into the OWNER's trash, so the owner can restore it.
        $this->trash->trash($path, $grant->owner_id);
        Audit::log('shared-trashed', 'Deleted an item from a shared folder', ['path' => $path]);

        return response()->json(['ok' => true]);
    }

    // --- internals ---

    /**
     * Verify the grant, bind the owner's disk on THIS instance, and (for writes)
     * assert the grant is writable.
     */
    private function bind(Request $request, FileGrant $grant, bool $write = false): void
    {
        $this->shared->grantFor($request->user(), $grant);
        if ($write) {
            abort_unless($grant->permission === 'write', 403, 'This share is read-only.');
        }
        // FileManager isn't a singleton: bind on the instance this controller uses.
        $this->files->useDisk($this->storage->local($grant->owner_id), true);
    }

    /** Bind (read) and return the requested path confined to the grant. */
    private function enter(Request $request, FileGrant $grant): string
    {
        $this->bind($request, $grant);

        return $this->shared->pathWithin($grant, $request->query('path'));
    }

    /** Normalise + assert a path stays inside the grant subtree. */
    private function confined(FileGrant $grant, string $path): string
    {
        return $this->shared->pathWithin($grant, $this->files->normalize($path));
    }

    private function stream(string $path, bool $attachment): StreamedResponse
    {
        $disk = $this->files->disk();

        if ($path === '' || ! $disk->exists($path)) {
            throw new HttpException(404, 'File not found.');
        }

        $headers = [
            'Content-Type' => $disk->mimeType($path) ?: 'application/octet-stream',
        ];
        if ($attachment) {
            $headers['Content-Length'] = (string) $disk->size($path);
        } else {
            $headers['Content-Disposition'] = 'inline; filename="'.basename($path).'"';
        }

        $callback = function () use ($disk, $path) {
            $stream = $disk->readStream($path);
            while (! feof($stream)) {
                echo fread($stream, 8192);
                flush();
            }
            fclose($stream);
        };

        return $attachment
            ? response()->streamDownload($callback, basename($path), $headers)
            : response()->stream($callback, 200, $headers);
    }
}
