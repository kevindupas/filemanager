<?php

namespace Tests\Feature;

use App\Models\FileComment;
use App\Models\FileGrant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Phase D: per-file comments, visible to the owner and to grantees of the path.
 */
class FileCommentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['manage-users', 'upload-files', 'delete-files', 'create-folders', 'share-files'] as $p) {
            Permission::firstOrCreate(['name' => $p]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions(Permission::all());
        Role::firstOrCreate(['name' => 'user']);
    }

    private function makeUser(): User
    {
        $u = User::factory()->create();
        $u->assignRole('admin');

        return $u;
    }

    private function grant(User $owner, User $grantee, string $path, string $permission = 'read'): FileGrant
    {
        return FileGrant::create([
            'owner_id' => $owner->id, 'grantee_id' => $grantee->id, 'path' => $path, 'permission' => $permission,
        ]);
    }

    public function test_owner_can_comment_on_and_read_their_own_file(): void
    {
        $alice = $this->makeUser();

        $this->actingAs($alice)
            ->postJson('/comments', ['owner_id' => $alice->id, 'path' => 'a.txt', 'body' => 'mine'])
            ->assertCreated();

        $this->actingAs($alice)
            ->getJson('/comments?owner='.$alice->id.'&path=a.txt')
            ->assertOk()
            ->assertJsonFragment(['body' => 'mine']);
    }

    public function test_grantee_can_comment_on_a_shared_file_and_see_owner_comments(): void
    {
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->grant($alice, $bob, 'Projects'); // folder grant covers files inside
        FileComment::create(['owner_id' => $alice->id, 'author_id' => $alice->id, 'path' => 'Projects/a.txt', 'body' => 'from alice']);

        $this->actingAs($bob)
            ->postJson('/comments', ['owner_id' => $alice->id, 'path' => 'Projects/a.txt', 'body' => 'from bob'])
            ->assertCreated();

        $this->actingAs($bob)
            ->getJson('/comments?owner='.$alice->id.'&path='.urlencode('Projects/a.txt'))
            ->assertOk()
            ->assertJsonFragment(['body' => 'from alice'])
            ->assertJsonFragment(['body' => 'from bob']);
    }

    public function test_user_without_a_grant_cannot_read_or_post(): void
    {
        $alice = $this->makeUser();
        $carol = $this->makeUser();

        $this->actingAs($carol)->getJson('/comments?owner='.$alice->id.'&path=a.txt')->assertForbidden();
        $this->actingAs($carol)->postJson('/comments', ['owner_id' => $alice->id, 'path' => 'a.txt', 'body' => 'x'])->assertForbidden();
    }

    public function test_grantee_cannot_comment_outside_the_grant(): void
    {
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->grant($alice, $bob, 'Projects');

        $this->actingAs($bob)
            ->postJson('/comments', ['owner_id' => $alice->id, 'path' => 'secret.txt', 'body' => 'sneaky'])
            ->assertForbidden();
    }

    public function test_author_can_delete_their_comment(): void
    {
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->grant($alice, $bob, 'Projects');
        $c = FileComment::create(['owner_id' => $alice->id, 'author_id' => $bob->id, 'path' => 'Projects/a.txt', 'body' => 'bob']);

        $this->actingAs($bob)->deleteJson("/comments/{$c->id}")->assertOk();
        $this->assertDatabaseMissing('file_comments', ['id' => $c->id]);
    }

    public function test_file_owner_can_delete_any_comment_on_their_file(): void
    {
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->grant($alice, $bob, 'Projects');
        $c = FileComment::create(['owner_id' => $alice->id, 'author_id' => $bob->id, 'path' => 'Projects/a.txt', 'body' => 'bob']);

        $this->actingAs($alice)->deleteJson("/comments/{$c->id}")->assertOk();
        $this->assertDatabaseMissing('file_comments', ['id' => $c->id]);
    }

    public function test_other_users_cannot_delete_a_comment(): void
    {
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $carol = $this->makeUser();
        $this->grant($alice, $bob, 'Projects');
        $this->grant($alice, $carol, 'Projects');
        $c = FileComment::create(['owner_id' => $alice->id, 'author_id' => $bob->id, 'path' => 'Projects/a.txt', 'body' => 'bob']);

        // Carol has access to the file but is neither author nor owner.
        $this->actingAs($carol)->deleteJson("/comments/{$c->id}")->assertForbidden();
        $this->assertDatabaseHas('file_comments', ['id' => $c->id]);
    }
}
