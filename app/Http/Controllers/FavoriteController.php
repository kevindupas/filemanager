<?php

namespace App\Http\Controllers;

use App\Models\Favorite;
use App\Services\FileManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Per-user favorites (starred files/folders). Open to any authenticated user.
 */
class FavoriteController extends Controller
{
    public function __construct(private readonly FileManager $files) {}

    /** Favorites page — drops entries whose target no longer exists. */
    public function index(Request $request): Response
    {
        $disk = $this->files->disk();

        $items = Favorite::where('user_id', $request->user()->id)
            ->latest()
            ->get()
            ->filter(fn (Favorite $f) => $disk->exists($f->path))
            ->map(fn (Favorite $f) => [
                'id' => $f->id,
                'name' => $f->name,
                'path' => $f->path,
                'type' => $f->type,
            ])
            ->values();

        return Inertia::render('favorites/index', ['favorites' => $items]);
    }

    /** Toggle a path in/out of the current user's favorites. */
    public function toggle(Request $request): JsonResponse
    {
        $data = $request->validate(['path' => ['required', 'string']]);

        $path = $this->files->normalize($data['path']);
        $disk = $this->files->disk();

        if ($path === '' || ! $disk->exists($path)) {
            throw new HttpException(404, 'Item not found.');
        }

        $existing = Favorite::where('user_id', $request->user()->id)->where('path', $path)->first();

        if ($existing) {
            $existing->delete();

            return response()->json(['favorited' => false]);
        }

        Favorite::create([
            'user_id' => $request->user()->id,
            'path' => $path,
            'name' => basename($path),
            'type' => $this->files->isDirectory($path) ? 'dir' : 'file',
        ]);

        return response()->json(['favorited' => true]);
    }
}
