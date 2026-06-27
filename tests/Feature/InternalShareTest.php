<?php

namespace Tests\Feature;

use App\Models\FileGrant;
use App\Models\User;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Phase A: account-to-account grant management (create / list / revoke).
 */
class InternalShareTest extends TestCase
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

    private function makeUser(string $role = 'admin'): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function userDisk(User $user): Filesystem
    {
        return Storage::build([
            'driver' => 'local',
            'root' => Storage::disk('local')->path('users/'.$user->id),
            'throw' => false,
        ]);
    }

    public function test_a_user_can_share_a_file_with_another_account(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->userDisk($alice)->put('report.pdf', 'x');

        $this->actingAs($alice)
            ->postJson('/shares/users', ['path' => 'report.pdf', 'email' => $bob->email, 'permission' => 'read'])
            ->assertCreated();

        $this->assertDatabaseHas('file_grants', [
            'owner_id' => $alice->id,
            'grantee_id' => $bob->id,
            'path' => 'report.pdf',
            'permission' => 'read',
        ]);
    }

    public function test_a_folder_can_be_shared_with_write_permission(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->userDisk($alice)->makeDirectory('Projects');

        $this->actingAs($alice)
            ->postJson('/shares/users', ['path' => 'Projects', 'email' => $bob->email, 'permission' => 'write'])
            ->assertCreated();

        $this->assertDatabaseHas('file_grants', [
            'owner_id' => $alice->id, 'grantee_id' => $bob->id, 'path' => 'Projects', 'permission' => 'write',
        ]);
    }

    public function test_resharing_updates_permission_without_duplicating(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->userDisk($alice)->put('a.txt', 'x');

        $this->actingAs($alice)->postJson('/shares/users', ['path' => 'a.txt', 'email' => $bob->email, 'permission' => 'read']);
        $this->actingAs($alice)->postJson('/shares/users', ['path' => 'a.txt', 'email' => $bob->email, 'permission' => 'write']);

        $this->assertSame(1, FileGrant::where('owner_id', $alice->id)->where('grantee_id', $bob->id)->where('path', 'a.txt')->count());
        $this->assertSame('write', FileGrant::where('owner_id', $alice->id)->where('grantee_id', $bob->id)->where('path', 'a.txt')->value('permission'));
    }

    public function test_cannot_share_with_yourself(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $this->userDisk($alice)->put('a.txt', 'x');

        $this->actingAs($alice)
            ->postJson('/shares/users', ['path' => 'a.txt', 'email' => $alice->email, 'permission' => 'read'])
            ->assertStatus(422);
    }

    public function test_cannot_share_a_nonexistent_path(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $bob = $this->makeUser();

        $this->actingAs($alice)
            ->postJson('/shares/users', ['path' => 'ghost.txt', 'email' => $bob->email, 'permission' => 'read'])
            ->assertStatus(422);
    }

    public function test_cannot_share_with_an_unknown_email(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $this->userDisk($alice)->put('a.txt', 'x');

        $this->actingAs($alice)
            ->postJson('/shares/users', ['path' => 'a.txt', 'email' => 'nobody@example.com', 'permission' => 'read'])
            ->assertStatus(422);
    }

    public function test_sharing_requires_the_share_files_permission(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser('user'); // no share-files
        $bob = $this->makeUser();
        $this->userDisk($alice)->put('a.txt', 'x');

        $this->actingAs($alice)
            ->postJson('/shares/users', ['path' => 'a.txt', 'email' => $bob->email, 'permission' => 'read'])
            ->assertForbidden();
    }

    public function test_for_path_lists_only_my_grants(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $carol = $this->makeUser();
        $this->userDisk($alice)->put('a.txt', 'x');

        $this->actingAs($alice)->postJson('/shares/users', ['path' => 'a.txt', 'email' => $bob->email, 'permission' => 'read']);
        // Carol has her own unrelated grant on her own a.txt — must not leak.
        $this->userDisk($carol)->put('a.txt', 'y');
        $this->actingAs($carol)->postJson('/shares/users', ['path' => 'a.txt', 'email' => $bob->email, 'permission' => 'read']);

        $this->actingAs($alice)->getJson('/shares/users?path=a.txt')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment(['grantee' => $bob->name, 'permission' => 'read']);
    }

    public function test_only_the_owner_can_revoke_a_grant(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->userDisk($alice)->put('a.txt', 'x');

        $this->actingAs($alice)->postJson('/shares/users', ['path' => 'a.txt', 'email' => $bob->email, 'permission' => 'read']);
        $grant = FileGrant::first();

        // Bob (the grantee) cannot revoke.
        $this->actingAs($bob)->deleteJson("/shares/users/{$grant->id}")->assertForbidden();
        $this->assertDatabaseHas('file_grants', ['id' => $grant->id]);

        // Owner can.
        $this->actingAs($alice)->deleteJson("/shares/users/{$grant->id}")->assertOk();
        $this->assertDatabaseMissing('file_grants', ['id' => $grant->id]);
    }
}
