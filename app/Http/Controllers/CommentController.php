<?php

namespace App\Http\Controllers;

use App\Models\FileComment;
use App\Models\FileGrant;
use App\Models\User;
use App\Services\FileManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Per-file comments. A file is addressed by (owner_id, path). Visible to the
 * owner and to anyone with a grant covering that path.
 */
class CommentController extends Controller
{
    public function __construct(private readonly FileManager $files) {}

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'owner' => ['required', 'integer'],
            'path' => ['required', 'string'],
        ]);

        $path = $this->files->normalize($data['path']);
        $this->authorizeAccess($request->user(), (int) $data['owner'], $path);

        $comments = FileComment::with('author')
            ->where('owner_id', $data['owner'])
            ->where('path', $path)
            ->oldest()
            ->get()
            ->map(fn (FileComment $c) => $this->present($c, $request->user()));

        return response()->json($comments);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'owner_id' => ['required', 'integer', 'exists:users,id'],
            'path' => ['required', 'string'],
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $path = $this->files->normalize($data['path']);
        $this->authorizeAccess($request->user(), (int) $data['owner_id'], $path);

        $comment = FileComment::create([
            'owner_id' => $data['owner_id'],
            'author_id' => $request->user()->id,
            'path' => $path,
            'body' => $data['body'],
        ]);
        $comment->setRelation('author', $request->user());

        return response()->json($this->present($comment, $request->user()), 201);
    }

    public function destroy(Request $request, FileComment $comment): JsonResponse
    {
        abort_unless(
            $comment->author_id === $request->user()->id || $comment->owner_id === $request->user()->id,
            403,
        );

        $comment->delete();

        return response()->json(['ok' => true]);
    }

    /** The owner, or any grantee whose grant covers this path, may read/post. */
    private function authorizeAccess(User $user, int $ownerId, string $path): void
    {
        if ($user->id === $ownerId) {
            return;
        }

        $covered = FileGrant::where('owner_id', $ownerId)
            ->where('grantee_id', $user->id)
            ->get()
            ->contains(fn (FileGrant $g) => $path === $g->path || str_starts_with($path, $g->path.'/'));

        abort_unless($covered, 403);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(FileComment $comment, User $viewer): array
    {
        return [
            'id' => $comment->id,
            'author' => $comment->author?->name,
            'body' => $comment->body,
            'created_at' => $comment->created_at?->toDateTimeString(),
            'can_delete' => $comment->author_id === $viewer->id || $comment->owner_id === $viewer->id,
        ];
    }
}
