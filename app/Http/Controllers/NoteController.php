<?php

namespace App\Http\Controllers;

use App\Models\Note;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Per-user encrypted notes. The body is encrypted at rest (model cast), so a
 * database dump is unreadable. Decrypted only for the owner over HTTPS.
 */
class NoteController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('notes/index', [
            'notes' => $this->forUser($request)->get()->map($this->present(...)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $note = Note::create([
            'user_id' => $request->user()->id,
            'body' => '',
            'pinned' => false,
        ]);

        return response()->json($this->present($note), 201);
    }

    public function update(Request $request, Note $note): JsonResponse
    {
        $this->authorizeOwner($request, $note);
        $data = $request->validate([
            'body' => ['sometimes', 'string'],
            'pinned' => ['sometimes', 'boolean'],
        ]);

        $note->update($data);

        return response()->json($this->present($note->refresh()));
    }

    public function destroy(Request $request, Note $note): JsonResponse
    {
        $this->authorizeOwner($request, $note);
        $note->delete();

        return response()->json(['ok' => true]);
    }

    private function forUser(Request $request)
    {
        return Note::where('user_id', $request->user()->id)
            ->orderByDesc('pinned')
            ->orderByDesc('updated_at');
    }

    private function authorizeOwner(Request $request, Note $note): void
    {
        abort_unless($note->user_id === $request->user()->id, 403);
    }

    /**
     * @return array{id: int, body: string, pinned: bool, updated_at: string}
     */
    private function present(Note $note): array
    {
        return [
            'id' => $note->id,
            'body' => (string) $note->body,
            'pinned' => (bool) $note->pinned,
            'updated_at' => $note->updated_at->toIso8601String(),
        ];
    }
}
