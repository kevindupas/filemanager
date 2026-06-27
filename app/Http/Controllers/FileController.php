<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessTransfer;
use App\Models\Favorite;
use App\Models\Transfer;
use App\Services\DiskResolver;
use App\Services\FileManager;
use App\Services\TrashManager;
use App\Support\Audit;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;
use Pion\Laravel\ChunkUpload\Exceptions\UploadMissingFileException;
use Pion\Laravel\ChunkUpload\Handler\HandlerFactory;
use Pion\Laravel\ChunkUpload\Receiver\FileReceiver;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;
use ZipStream\ZipStream;

class FileController extends Controller
{
    public function __construct(
        private readonly FileManager $files,
        private readonly TrashManager $trash,
        private readonly DiskResolver $disks,
    ) {}

    /**
     * Resolve the ?disk= target, point the FileManager at it, and return the
     * resolved disk descriptor (key/label/type/isLocal).
     *
     * @return array{key: string, label: string, type: string, isLocal: bool, filesystem: Filesystem}
     */
    private function activeDisk(Request $request): array
    {
        $disk = $this->disks->resolve($request->input('disk'), $request->user());
        $this->files->useDisk($disk['filesystem'], $disk['isLocal']);

        return $disk;
    }

    /**
     * Browser page: list the directory at ?path= and expose the current
     * user's permission flags so the UI can hide unauthorized actions.
     */
    public function index(Request $request): Response
    {
        $disk = $this->activeDisk($request);
        $path = $this->files->normalize($request->query('path'));
        $query = trim((string) $request->query('search', ''));
        $local = $disk['isLocal'];

        return Inertia::render('files/browser', [
            'listing' => $this->files->list($path),
            'search' => $query === '' ? null : $this->files->search($path, $query),
            // Favorites/shares are local-only for now.
            'favorites' => $local ? Favorite::where('user_id', $request->user()->id)->pluck('path') : [],
            'disk' => $disk['key'],
            'disks' => $this->disks->available($request->user()),
            'can' => [
                'upload' => $request->user()->can('upload-files'),
                'delete' => $request->user()->can('delete-files'),
                'createFolders' => $request->user()->can('create-folders'),
                'share' => $local && $request->user()->can('share-files'),
                'favorite' => $local,
                'isLocal' => $local,
            ],
        ]);
    }

    /**
     * Move or copy items into a destination folder. Open to any authenticated
     * user (consistent with rename). $copy is set by the route.
     */
    public function transfer(Request $request, bool $copy): RedirectResponse
    {
        @set_time_limit(0); // large/remote transfers can run well past the PHP default
        $source = $this->activeDisk($request);
        $data = $request->validate([
            'paths' => ['required', 'array', 'min:1'],
            'paths.*' => ['required', 'string'],
            'destination' => ['nullable', 'string'],
            'destDisk' => ['nullable', 'string'],
            'resolutions' => ['nullable', 'array'], // srcPath => overwrite|keep|skip
            'resolutions.*' => ['in:overwrite,keep,skip'],
        ]);

        $destKey = $data['destDisk'] ?? $source['key'];
        $destination = $data['destination'] ?? '';
        $resolutions = $data['resolutions'] ?? [];

        if ($destKey === $source['key']) {
            // Same disk → native rename/copy (instant, synchronous).
            $result = $this->files->transfer($data['paths'], $destination, $copy, $resolutions);

            $verb = $copy ? 'Copied' : 'Moved';
            Audit::log($copy ? 'copied' : 'moved', "{$verb} {$result['done']} item(s)", ['paths' => $data['paths']]);
            $request->session()->flash('success', "{$verb} {$result['done']} item(s).");
            if (! empty($result['errors'])) {
                $request->session()->flash('error', implode(' · ', $result['errors']));
            }

            return back();
        }

        // Cross-disk → background job with live progress (watch the transfers panel).
        $transfer = Transfer::create([
            'user_id' => $request->user()->id,
            'mode' => $copy ? 'copy' : 'move',
            'source_disk' => $source['key'],
            'dest_disk' => $destKey,
            'destination' => $destination,
            'paths' => array_values($data['paths']),
            'resolutions' => $resolutions,
        ]);
        ProcessTransfer::dispatch($transfer->id);
        Audit::log($copy ? 'copied' : 'moved', ($copy ? 'Copy' : 'Move').' queued '.$source['key'].' → '.$destKey, [
            'paths' => $data['paths'],
        ]);
        $request->session()->flash('success', 'Transfer started in the background.');

        return back();
    }

    /**
     * Report which dropped items already exist at the destination, so the UI can
     * ask the user how to resolve each conflict before the transfer runs.
     */
    public function checkTransfer(Request $request): JsonResponse
    {
        $source = $this->activeDisk($request);
        $data = $request->validate([
            'paths' => ['required', 'array', 'min:1'],
            'paths.*' => ['required', 'string'],
            'destination' => ['nullable', 'string'],
            'destDisk' => ['nullable', 'string'],
        ]);

        $destKey = $data['destDisk'] ?? $source['key'];
        $destDir = $this->files->normalize($data['destination'] ?? '');
        $destFs = $destKey === $source['key']
            ? $source['filesystem']
            : $this->disks->resolve($destKey, $request->user())['filesystem'];

        $conflicts = [];
        foreach ($data['paths'] as $raw) {
            $src = $this->files->normalize((string) $raw);
            if ($src === '') {
                continue;
            }
            $target = $destDir === '' ? basename($src) : $destDir.'/'.basename($src);
            if ($target === $src && $destKey === $source['key']) {
                continue; // same spot — handled as a no-op later
            }
            if ($destFs->exists($target) || $this->files->isDirOn($destFs, $target)) {
                $conflicts[] = ['path' => $src, 'name' => basename($src)];
            }
        }

        return response()->json(['conflicts' => $conflicts]);
    }

    public function move(Request $request): RedirectResponse
    {
        return $this->transfer($request, copy: false);
    }

    public function copy(Request $request): RedirectResponse
    {
        return $this->transfer($request, copy: true);
    }

    /** Save edited text content back to a file (in-app editor). */
    public function save(Request $request): JsonResponse
    {
        $this->activeDisk($request);
        $data = $request->validate([
            'path' => ['required', 'string'],
            'content' => ['present', 'string', 'max:5242880'], // 5 MB ceiling
        ]);

        $path = $this->files->normalize($data['path']);
        $disk = $this->files->disk();
        if ($path === '' || ! $disk->exists($path)) {
            throw new HttpException(404, 'File not found.');
        }
        $this->files->absolutePath($path); // assert under root

        $disk->put($path, $data['content']);
        Audit::log('edited', "Edited “{$path}”", ['path' => $path]);

        return response()->json(['ok' => true]);
    }

    /**
     * Directory listing as JSON (for the dual-pane commander).
     */
    public function list(Request $request)
    {
        $this->activeDisk($request);
        $path = $this->files->normalize($request->query('path'));

        return response()->json($this->files->list($path));
    }

    /**
     * Subdirectories of a path as JSON, for the move/copy folder picker.
     */
    public function dirs(Request $request)
    {
        $this->activeDisk($request);
        $path = $this->files->normalize($request->query('path'));

        return response()->json($this->files->subdirectories($path));
    }

    /**
     * Create a directory (permission: create-folders).
     */
    public function storeFolder(Request $request): RedirectResponse
    {
        $this->activeDisk($request);
        $data = $request->validate([
            'path' => ['nullable', 'string'],
            'name' => ['required', 'string', 'max:255', 'regex:/^[^\/\\\\\0]+$/'],
        ]);

        $parent = $this->files->normalize($data['path'] ?? '');
        $target = $this->files->normalize($parent.'/'.$data['name']);
        $disk = $this->files->disk();

        if ($disk->exists($target)) {
            return back()->withErrors(['name' => 'A file or folder with that name already exists.']);
        }

        $disk->makeDirectory($target);
        Audit::log('created-folder', "Created folder “{$data['name']}”", ['path' => $target]);

        return back()->with('success', 'Folder created.');
    }

    /**
     * Rename a file or folder within its current directory.
     */
    public function rename(Request $request): RedirectResponse
    {
        $this->activeDisk($request);
        $data = $request->validate([
            'path' => ['required', 'string'],
            'name' => ['required', 'string', 'max:255', 'regex:/^[^\/\\\\\0]+$/'],
        ]);

        $source = $this->files->normalize($data['path']);
        $disk = $this->files->disk();

        if ($source === '' || ! $disk->exists($source)) {
            throw new HttpException(404, 'Item not found.');
        }
        $this->files->absolutePath($source); // assert under root

        $directory = trim(dirname($source), '.');
        $target = $this->files->normalize(($directory === '' ? '' : $directory.'/').$data['name']);

        if ($disk->exists($target)) {
            return back()->withErrors(['name' => 'A file or folder with that name already exists.']);
        }

        $disk->move($source, $target);
        Audit::log('renamed', "Renamed “{$source}” → “{$data['name']}”", ['from' => $source, 'to' => $target]);

        return back()->with('success', 'Renamed.');
    }

    /**
     * Delete a file or folder (permission: delete-files).
     */
    public function destroy(Request $request): RedirectResponse
    {
        $local = $this->activeDisk($request)['isLocal'];
        $data = $request->validate([
            'path' => ['required_without:paths', 'string'],
            'paths' => ['required_without:path', 'array', 'min:1'],
            'paths.*' => ['string'],
        ]);

        $targets = $data['paths'] ?? [$data['path']];
        $disk = $this->files->disk();
        $deleted = 0;

        foreach ($targets as $raw) {
            $path = $this->files->normalize($raw);

            if ($path === '' || ! $disk->exists($path)) {
                continue;
            }

            if ($local) {
                // Soft-delete: move to the recycle bin instead of erasing.
                $this->trash->trash($path, $request->user()->id);
            } elseif ($this->files->isDirectory($path)) {
                $disk->deleteDirectory($path);
            } else {
                $disk->delete($path);
            }
            $deleted++;
        }

        Audit::log($local ? 'trashed' : 'deleted', ($local ? "Moved {$deleted} item(s) to trash" : "Permanently deleted {$deleted} item(s)"), ['paths' => $targets]);

        return back()->with('success', $local ? "Moved {$deleted} item(s) to trash." : "Deleted {$deleted} item(s).");
    }

    /**
     * Stream a file download. The file is never fully loaded into memory:
     * we pipe the underlying read stream in chunks.
     *
     * To offload streaming from PHP-FPM behind nginx later, replace the body
     * with an X-Accel-Redirect header pointing at an internal location that
     * maps to the storage path, e.g.:
     *   return response('', 200, [
     *       'X-Accel-Redirect' => '/internal-storage/'.$relative,
     *       'Content-Disposition' => 'attachment; filename="'.basename($relative).'"',
     *   ]);
     * (and add an `internal; alias storage/app/private/;` location in nginx).
     */
    public function download(Request $request): StreamedResponse
    {
        @set_time_limit(0);
        $this->activeDisk($request);
        $path = $this->files->normalize($request->query('path'));
        $disk = $this->files->disk();

        if ($path === '' || ! $disk->exists($path)) {
            throw new HttpException(404, 'File not found.');
        }
        $this->files->absolutePath($path); // assert under root

        $name = basename($path);
        $size = $disk->size($path);
        $mime = $disk->mimeType($path) ?: 'application/octet-stream';

        return response()->streamDownload(function () use ($disk, $path) {
            $stream = $disk->readStream($path);
            while (! feof($stream)) {
                echo fread($stream, 8192);
                flush();
            }
            fclose($stream);
        }, $name, [
            'Content-Type' => $mime,
            'Content-Length' => (string) $size,
        ]);
    }

    /**
     * Stream a ZIP of the given paths (files and/or folders). Built on the fly
     * with ZipStream — nothing is buffered to disk or fully into memory.
     */
    public function zip(Request $request): StreamedResponse
    {
        @set_time_limit(0);
        $this->activeDisk($request);
        $data = $request->validate([
            'paths' => ['required', 'array', 'min:1'],
            'paths.*' => ['string'],
        ]);

        $disk = $this->files->disk();
        $entries = []; // archive-relative name => disk path

        foreach ($data['paths'] as $raw) {
            $path = $this->files->normalize($raw);
            if ($path === '' || ! $disk->exists($path)) {
                continue;
            }
            $this->files->absolutePath($path);

            if ($this->files->isDirectory($path)) {
                $base = basename($path);
                foreach ($disk->allFiles($path) as $file) {
                    $entries[$base.'/'.substr($file, strlen($path) + 1)] = $file;
                }
            } else {
                $entries[basename($path)] = $path;
            }
        }

        $first = $this->files->normalize($data['paths'][0]);
        $name = count($data['paths']) === 1 && $this->files->isDirectory($first)
            ? basename($first).'.zip'
            : 'archive.zip';

        return response()->streamDownload(function () use ($entries, $disk) {
            $zip = new ZipStream(sendHttpHeaders: false);
            foreach ($entries as $archiveName => $diskPath) {
                $stream = $disk->readStream($diskPath);
                $zip->addFileFromStream($archiveName, $stream);
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }
            $zip->finish();
        }, $name, ['Content-Type' => 'application/zip']);
    }

    /**
     * Cached image thumbnail (JPEG). Non-images return 404 so the UI falls
     * back to an icon. Cache key includes mtime, so edits bust the cache.
     */
    public function thumb(Request $request)
    {
        @set_time_limit(0);
        $resolved = $this->activeDisk($request);
        $path = $this->files->normalize($request->query('path'));
        $disk = $this->files->disk();

        if ($path === '' || ! $disk->exists($path)) {
            throw new HttpException(404, 'Not found.');
        }
        $this->files->absolutePath($path);

        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        if (! in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif'], true)) {
            throw new HttpException(404, 'Not an image.');
        }

        $thumbs = Storage::disk('thumbs');
        // Namespace by user so two accounts with the same path can't share a thumb.
        $key = sha1($request->user()->id.'|'.$resolved['key'].'|'.$path).'-'.$disk->lastModified($path).'.jpg';

        if (! $thumbs->exists($key)) {
            // Decode from the file's bytes so it works on any disk (local or remote).
            $image = (new ImageManager(new Driver))->decode($disk->get($path))->scaleDown(320, 320);
            $thumbs->put($key, (string) $image->encodeUsingFileExtension('jpg', quality: 75));
        }

        return response($thumbs->get($key), 200, [
            'Content-Type' => 'image/jpeg',
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    /**
     * Return detailed metadata for a file or folder as JSON (any authed user).
     */
    public function info(Request $request)
    {
        $this->activeDisk($request);
        $path = $this->files->normalize($request->query('path'));

        return response()->json($this->files->info($path));
    }

    /**
     * Stream a file inline for in-browser preview (image/pdf/video/audio/text).
     * Same root confinement as download, but Content-Disposition: inline.
     */
    public function preview(Request $request): SymfonyResponse
    {
        @set_time_limit(0);
        $this->activeDisk($request);
        $path = $this->files->normalize($request->query('path'));
        $disk = $this->files->disk();

        if ($path === '' || ! $disk->exists($path)) {
            throw new HttpException(404, 'File not found.');
        }
        $abs = $this->files->absolutePath($path); // assert under root; '' on remote disks

        // Local files: serve a real file response so the browser gets HTTP Range
        // support (seeking in <video>/<audio>, partial loads).
        if ($abs !== '') {
            return response()->file($abs, ['Content-Disposition' => 'inline; filename="'.basename($path).'"']);
        }

        $mime = $disk->mimeType($path) ?: 'application/octet-stream';

        return response()->stream(function () use ($disk, $path) {
            $stream = $disk->readStream($path);
            while (! feof($stream)) {
                echo fread($stream, 8192);
                flush();
            }
            fclose($stream);
        }, 200, [
            'Content-Type' => $mime,
            'Content-Length' => (string) $disk->size($path),
            'Content-Disposition' => 'inline; filename="'.basename($path).'"',
        ]);
    }

    /**
     * Receive a chunked/resumable upload (permission: upload-files).
     * Chunks are reassembled by pion/laravel-chunk-upload; the finished file
     * is moved into the current directory on the local disk.
     */
    public function upload(Request $request)
    {
        @set_time_limit(0);
        $local = $this->activeDisk($request)['isLocal'];
        $request->validate(['path' => ['nullable', 'string']]);

        $receiver = new FileReceiver('file', $request, HandlerFactory::classFromRequest($request));

        if (! $receiver->isUploaded()) {
            throw new UploadMissingFileException;
        }

        $save = $receiver->receive();

        if (! $save->isFinished()) {
            // Still receiving chunks — report progress.
            return response()->json([
                'done' => $save->handler()->getPercentageDone(),
                'status' => false,
            ]);
        }

        $file = $save->getFile();

        // Reject the assembled file if it would push storage over the quota (local only).
        if ($local && $this->files->exceedsQuota((int) $file->getSize())) {
            @unlink($file->getPathname());

            return response()->json(['status' => false, 'error' => 'Storage quota exceeded.'], 422);
        }

        $dir = $this->files->normalize($request->input('path', ''));

        // Keep the original filename, sanitised to a single path segment.
        $filename = $this->files->normalize($file->getClientOriginalName());
        $filename = basename($filename) ?: 'upload';
        $target = $this->files->normalize(($dir === '' ? '' : $dir.'/').$filename);

        // Confirm the destination directory resolves under the root.
        $this->files->absolutePath($target, mustExist: false);

        $stream = fopen($file->getPathname(), 'rb');
        $this->files->disk()->writeStream($target, $stream);
        if (is_resource($stream)) {
            fclose($stream);
        }
        @unlink($file->getPathname());
        Audit::log('uploaded', "Uploaded “{$filename}”", ['path' => $target]);

        return response()->json([
            'done' => 100,
            'status' => true,
            'filename' => $filename,
        ]);
    }
}
