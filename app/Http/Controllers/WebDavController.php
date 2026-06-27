<?php

namespace App\Http\Controllers;

use App\Services\FileManager;
use App\Services\TrashManager;
use App\Services\VersionManager;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Minimal WebDAV server over the caller's own partition (token via HTTP Basic).
 * Supports the verbs a desktop client needs to mount and edit files:
 * OPTIONS, PROPFIND, GET/HEAD, PUT, DELETE, MKCOL, MOVE.
 */
class WebDavController extends Controller
{
    private const BASE = '/api/webdav/';

    public function __construct(
        private readonly FileManager $files,
        private readonly TrashManager $trash,
        private readonly VersionManager $versions,
    ) {}

    public function handle(Request $request, string $path = ''): Response
    {
        $rel = $this->files->normalize($path);

        return match ($request->getMethod()) {
            'OPTIONS' => $this->options(),
            'PROPFIND' => $this->propfind($request, $rel),
            'GET', 'HEAD' => $this->get($rel, $request->isMethod('HEAD')),
            'PUT' => $this->put($request, $rel),
            'DELETE' => $this->delete($request, $rel),
            'MKCOL' => $this->mkcol($rel),
            'MOVE' => $this->move($request, $rel),
            default => response('Method Not Allowed', 405),
        };
    }

    private function options(): Response
    {
        return response('', 200, [
            'Allow' => 'OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MKCOL, MOVE',
            'DAV' => '1',
        ]);
    }

    private function get(string $rel, bool $headOnly): Response
    {
        $disk = $this->files->disk();
        if ($rel === '' || ! $disk->exists($rel)) {
            throw new HttpException(404, 'Not found.');
        }

        $headers = [
            'Content-Type' => $disk->mimeType($rel) ?: 'application/octet-stream',
            'Content-Length' => (string) $disk->size($rel),
        ];

        if ($headOnly) {
            return response('', 200, $headers);
        }

        return response($disk->get($rel), 200, $headers);
    }

    private function put(Request $request, string $rel): Response
    {
        abort_unless($request->user()->can('upload-files'), 403);
        if ($rel === '') {
            throw new HttpException(409, 'Invalid path.');
        }

        $content = $request->getContent();
        if ($this->files->exceedsQuota(strlen($content))) {
            throw new HttpException(507, 'Insufficient storage (quota).');
        }

        $disk = $this->files->disk();
        $existed = $disk->exists($rel);
        if ($existed) {
            $this->versions->snapshot($disk, $request->user()->id, $rel);
        }
        $disk->put($rel, $content);

        return response('', $existed ? 204 : 201);
    }

    private function delete(Request $request, string $rel): Response
    {
        abort_unless($request->user()->can('delete-files'), 403);
        if ($rel === '') {
            throw new HttpException(403, 'Refusing to delete the root.');
        }

        $this->trash->trash($rel, $request->user()->id);

        return response('', 204);
    }

    private function mkcol(string $rel): Response
    {
        if ($rel === '') {
            throw new HttpException(409, 'Invalid path.');
        }
        $this->files->disk()->makeDirectory($rel);

        return response('', 201);
    }

    private function move(Request $request, string $rel): Response
    {
        abort_unless($request->user()->can('upload-files'), 403);
        $destHeader = (string) $request->header('Destination');
        $dest = $this->files->normalize($this->stripBase($destHeader));

        if ($rel === '' || $dest === '') {
            throw new HttpException(409, 'Invalid move.');
        }

        $disk = $this->files->disk();
        if (! $disk->exists($rel) && ! $this->files->isDirectory($rel)) {
            throw new HttpException(404, 'Source not found.');
        }
        $disk->move($rel, $dest);

        return response('', 201);
    }

    private function propfind(Request $request, string $rel): Response
    {
        $disk = $this->files->disk();
        $isDir = $rel === '' || $this->files->isDirectory($rel);

        if (! $isDir && ! $disk->exists($rel)) {
            throw new HttpException(404, 'Not found.');
        }

        $depth = $request->header('Depth', '1');
        $entries = [$this->describe($rel, $isDir)];

        if ($isDir && $depth !== '0') {
            foreach ($disk->directories($rel) as $dir) {
                if (! str_starts_with(basename($dir), '.')) {
                    $entries[] = $this->describe($dir, true);
                }
            }
            foreach ($disk->files($rel) as $file) {
                if (! str_starts_with(basename($file), '.')) {
                    $entries[] = $this->describe($file, false);
                }
            }
        }

        $xml = '<?xml version="1.0" encoding="utf-8"?>'."\n".'<d:multistatus xmlns:d="DAV:">';
        foreach ($entries as $e) {
            $type = $e['dir'] ? '<d:resourcetype><d:collection/></d:resourcetype>' : '<d:resourcetype/>';
            $size = $e['dir'] ? '' : '<d:getcontentlength>'.$e['size'].'</d:getcontentlength>';
            $xml .= '<d:response>'
                .'<d:href>'.htmlspecialchars($e['href'], ENT_XML1).'</d:href>'
                .'<d:propstat><d:prop>'
                .$type
                .$size
                .'<d:getlastmodified>'.gmdate('D, d M Y H:i:s', $e['modified']).' GMT</d:getlastmodified>'
                .'</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>'
                .'</d:response>';
        }
        $xml .= '</d:multistatus>';

        return response($xml, 207, ['Content-Type' => 'application/xml; charset=utf-8']);
    }

    /**
     * @return array{href: string, dir: bool, size: int, modified: int}
     */
    private function describe(string $rel, bool $dir): array
    {
        $disk = $this->files->disk();
        $href = self::BASE.implode('/', array_map('rawurlencode', array_filter(explode('/', $rel), fn ($s) => $s !== '')));
        if ($dir) {
            $href = rtrim($href, '/').'/';
        }

        return [
            'href' => $href,
            'dir' => $dir,
            'size' => $dir ? 0 : $this->safeSize($disk, $rel),
            'modified' => $this->safeModified($disk, $rel),
        ];
    }

    private function safeSize($disk, string $rel): int
    {
        try {
            return $rel === '' ? 0 : $disk->size($rel);
        } catch (\Throwable) {
            return 0;
        }
    }

    private function safeModified($disk, string $rel): int
    {
        try {
            return $rel === '' ? time() : $disk->lastModified($rel);
        } catch (\Throwable) {
            return time();
        }
    }

    /** Strip the WebDAV base (and host) from a Destination header to a relative path. */
    private function stripBase(string $destination): string
    {
        $path = parse_url($destination, PHP_URL_PATH) ?: $destination;
        $path = rawurldecode($path);

        return str_contains($path, self::BASE) ? substr($path, strpos($path, self::BASE) + strlen(self::BASE)) : $path;
    }
}
