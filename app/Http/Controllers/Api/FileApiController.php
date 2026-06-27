<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FileManager;
use App\Services\TrashManager;
use App\Services\VersionManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Token-authenticated REST API over the caller's own (local) partition.
 * The token middleware resolves the user, so FileManager confines to their
 * partition automatically.
 */
class FileApiController extends Controller
{
    public function __construct(
        private readonly FileManager $files,
        private readonly TrashManager $trash,
        private readonly VersionManager $versions,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $path = $this->files->normalize($request->query('path'));

        return response()->json($this->files->list($path));
    }

    public function download(Request $request): StreamedResponse
    {
        $path = $this->files->normalize($request->query('path'));
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

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('upload-files'), 403);
        $request->validate(['path' => ['nullable', 'string'], 'file' => ['required', 'file']]);

        $dir = $this->files->normalize($request->input('path', ''));
        $file = $request->file('file');

        if ($this->files->exceedsQuota((int) $file->getSize())) {
            return response()->json(['message' => 'Storage quota exceeded.'], 422);
        }

        $name = basename($this->files->normalize($file->getClientOriginalName())) ?: 'upload';
        $target = $this->files->normalize(($dir === '' ? '' : $dir.'/').$name);
        $this->files->absolutePath($target, mustExist: false);

        $disk = $this->files->disk();
        if ($disk->exists($target)) {
            $this->versions->snapshot($disk, $request->user()->id, $target);
        }
        $stream = fopen($file->getPathname(), 'rb');
        $disk->writeStream($target, $stream);
        if (is_resource($stream)) {
            fclose($stream);
        }

        return response()->json(['ok' => true, 'path' => $target], 201);
    }

    public function destroy(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('delete-files'), 403);
        $data = $request->validate(['path' => ['required', 'string']]);

        $this->trash->trash($this->files->normalize($data['path']), $request->user()->id);

        return response()->json(['ok' => true]);
    }
}
