<?php

namespace App\Http\Controllers;

use App\Models\FileShare;
use App\Services\FileManager;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Public (unauthenticated) access to shared files. Every hit re-validates the
 * share (expiry, password) and that the underlying file still exists under the
 * disk root. Routes are rate-limited (see web.php).
 */
class PublicShareController extends Controller
{
    public function __construct(private readonly FileManager $files) {}

    public function show(Request $request, string $token): Response
    {
        $share = $this->find($token);

        if ($share->isExpired()) {
            return Inertia::render('shares/public', ['state' => 'expired']);
        }

        if ($share->hasPassword() && ! $this->unlocked($request, $share)) {
            return Inertia::render('shares/public', [
                'state' => 'locked',
                'token' => $token,
                'name' => $share->name,
            ]);
        }

        if (! $this->files->disk()->exists($this->safePath($share))) {
            return Inertia::render('shares/public', ['state' => 'gone']);
        }

        $path = $this->safePath($share);

        return Inertia::render('shares/public', [
            'state' => 'ready',
            'token' => $token,
            'name' => $share->name,
            'size' => $this->files->disk()->size($path),
            'mime' => $this->files->disk()->mimeType($path) ?: 'application/octet-stream',
            'downloadUrl' => url("/s/{$token}/download"),
            'previewUrl' => url("/s/{$token}/preview"),
        ]);
    }

    public function unlock(Request $request, string $token)
    {
        $share = $this->find($token);
        $request->validate(['password' => ['required', 'string']]);

        if (! $share->hasPassword() || ! Hash::check($request->input('password'), $share->password)) {
            return back()->with('error', 'Wrong password.');
        }

        $request->session()->put($this->sessionKey($token), true);

        return redirect("/s/{$token}");
    }

    public function download(Request $request, string $token): StreamedResponse
    {
        $share = $this->authorized($request, $token);
        $path = $this->safePath($share);
        $disk = $this->files->disk();

        $share->forceFill(['downloads' => $share->downloads + 1, 'last_accessed_at' => now()])->save();

        return response()->streamDownload(function () use ($disk, $path) {
            $stream = $disk->readStream($path);
            while (! feof($stream)) {
                echo fread($stream, 8192);
                flush();
            }
            fclose($stream);
        }, $share->name, [
            'Content-Type' => $disk->mimeType($path) ?: 'application/octet-stream',
            'Content-Length' => (string) $disk->size($path),
        ]);
    }

    public function preview(Request $request, string $token): StreamedResponse
    {
        $share = $this->authorized($request, $token);
        $path = $this->safePath($share);
        $disk = $this->files->disk();

        return response()->stream(function () use ($disk, $path) {
            $stream = $disk->readStream($path);
            while (! feof($stream)) {
                echo fread($stream, 8192);
                flush();
            }
            fclose($stream);
        }, 200, [
            'Content-Type' => $disk->mimeType($path) ?: 'application/octet-stream',
            'Content-Disposition' => 'inline; filename="'.$share->name.'"',
        ]);
    }

    private function find(string $token): FileShare
    {
        return FileShare::where('token', $token)->firstOr(fn () => throw new HttpException(404, 'Share not found.'));
    }

    /** Resolve + assert a share that is allowed to stream right now. */
    private function authorized(Request $request, string $token): FileShare
    {
        $share = $this->find($token);

        if ($share->isExpired()) {
            throw new HttpException(410, 'This link has expired.');
        }
        if ($share->hasPassword() && ! $this->unlocked($request, $share)) {
            throw new HttpException(403, 'Password required.');
        }
        if (! $this->files->disk()->exists($this->safePath($share))) {
            throw new HttpException(404, 'File no longer exists.');
        }

        return $share;
    }

    /** Re-normalise the stored path and confirm it stays under the root. */
    private function safePath(FileShare $share): string
    {
        $path = $this->files->normalize($share->path);
        $this->files->absolutePath($path, mustExist: false); // confinement check only

        return $path;
    }

    private function unlocked(Request $request, FileShare $share): bool
    {
        return $request->session()->get($this->sessionKey($share->token)) === true;
    }

    private function sessionKey(string $token): string
    {
        return 'share_unlocked_'.$token;
    }
}
