<?php

namespace Tests\Feature;

use App\Models\Note;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class NotesTest extends TestCase
{
    use RefreshDatabase;

    public function test_note_body_is_encrypted_at_rest(): void
    {
        $user = User::factory()->create();
        $note = Note::create(['user_id' => $user->id, 'body' => 'my secret note']);

        // Raw column must NOT contain the plaintext (a DB dump is unreadable)…
        $raw = DB::table('notes')->where('id', $note->id)->value('body');
        $this->assertNotSame('my secret note', $raw);
        $this->assertStringNotContainsString('my secret note', $raw);

        // …but the model decrypts it for the owner.
        $this->assertSame('my secret note', $note->fresh()->body);
    }

    public function test_user_only_sees_own_notes(): void
    {
        $me = User::factory()->create();
        $other = User::factory()->create();
        Note::create(['user_id' => $me->id, 'body' => 'mine']);
        Note::create(['user_id' => $other->id, 'body' => 'theirs']);

        $this->actingAs($me)->get('/notes')->assertOk()
            ->assertInertia(fn ($page) => $page->component('notes/index')->has('notes', 1));
    }

    public function test_store_creates_a_note_for_the_user(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/notes')->assertCreated()->assertJsonStructure(['id', 'body', 'pinned', 'updated_at']);
        $this->assertDatabaseCount('notes', 1);
    }

    public function test_cannot_touch_another_users_note(): void
    {
        $me = User::factory()->create();
        $note = Note::create(['user_id' => User::factory()->create()->id, 'body' => 'theirs']);

        $this->actingAs($me)->patchJson("/notes/{$note->id}", ['body' => 'hacked'])->assertForbidden();
        $this->actingAs($me)->deleteJson("/notes/{$note->id}")->assertForbidden();
        $this->assertSame('theirs', $note->fresh()->body);
    }
}
