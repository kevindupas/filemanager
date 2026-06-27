<?php

namespace App\Http\Controllers;

use App\Models\FileGrant;
use App\Models\User;
use App\Services\FileManager;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Account-to-account share grants (internal sharing). Distinct from public
 * token links (ShareController). Owner-side management: create / list / revoke.
 */
class UserShareController extends Controller
{
    public function __construct(private readonly FileManager $files) {}

    /** Grants the current user created on a given path. */
    public function forPath(Request $request): JsonResponse
    {
        $path = $this->files->normalize($request->query('path'));

        return response()->json(
            FileGrant::with('grantee')
                ->where('owner_id', $request->user()->id)
                ->where('path', $path)
                ->latest()
                ->get()
                ->map($this->present(...))
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['required', 'string'],
            'email' => ['required', 'email', 'exists:users,email'],
            'permission' => ['required', 'in:read,write'],
        ]);

        $path = $this->files->normalize($data['path']);
        $disk = $this->files->disk();

        if ($path === '' || (! $disk->exists($path) && ! $this->files->isDirectory($path))) {
            throw new HttpException(422, 'Only existing files or folders can be shared.');
        }

        $grantee = User::where('email', $data['email'])->firstOrFail();
        if ($grantee->id === $request->user()->id) {
            throw new HttpException(422, 'You cannot share with yourself.');
        }

        $grant = FileGrant::updateOrCreate(
            ['owner_id' => $request->user()->id, 'grantee_id' => $grantee->id, 'path' => $path],
            ['permission' => $data['permission']],
        );
        $grant->setRelation('grantee', $grantee);

        Audit::log('shared-user', "Shared “{$path}” with {$grantee->email} ({$data['permission']})", ['path' => $path]);

        return response()->json($this->present($grant), 201);
    }

    public function destroy(Request $request, FileGrant $grant): JsonResponse
    {
        abort_unless($grant->owner_id === $request->user()->id, 403);

        Audit::log('unshared-user', "Revoked access to “{$grant->path}”", ['path' => $grant->path]);
        $grant->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(FileGrant $grant): array
    {
        return [
            'id' => $grant->id,
            'path' => $grant->path,
            'grantee' => $grant->grantee?->name,
            'email' => $grant->grantee?->email,
            'permission' => $grant->permission,
            'created_at' => $grant->created_at?->toDateTimeString(),
        ];
    }
}
