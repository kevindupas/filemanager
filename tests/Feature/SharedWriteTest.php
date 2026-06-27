<?php

namespace Tests\Feature;

use App\Models\FileGrant;
use App\Models\User;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Phase C: write access inside a grant. Writes land in the owner's partition
 * (charged to the owner's quota) and stay confined to the granted subtree.
 */
class SharedWriteTest extends TestCase
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

    private function makeUser(string $role = 'admin', ?int $quota = null): User
    {
        $u = User::factory()->create(['quota_bytes' => $quota]);
        $u->assignRole($role);

        return $u;
    }

    private function userDisk(User $user): Filesystem
    {
        return Storage::build([
            'driver' => 'local',
            'root' => Storage::disk('local')->path('users/'.$user->id),
            'throw' => false,
        ]);
    }

    private function grant(User $owner, User $grantee, string $path, string $permission): FileGrant
    {
        return FileGrant::create([
            'owner_id' => $owner->id, 'grantee_id' => $grantee->id, 'path' => $path, 'permission' => $permission,
        ]);
    }

    public function test_grantee_with_write_can_create_a_folder_in_the_owner_partition(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->userDisk($alice)->makeDirectory('Projects');
        $g = $this->grant($alice, $bob, 'Projects', 'write');

        $this->actingAs($bob)->post("/shared/{$g->id}/folders", ['path' => 'Projects', 'name' => 'Sub'])
            ->assertRedirect();

        $this->userDisk($alice)->assertExists('Projects/Sub');
    }

    public function test_grantee_with_write_can_upload_into_the_grant(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->userDisk($alice)->makeDirectory('Projects');
        $g = $this->grant($alice, $bob, 'Projects', 'write');

        $this->actingAs($bob)->post("/shared/{$g->id}/upload", [
            'path' => 'Projects',
            'file' => UploadedFile::fake()->create('doc.txt', 1),
        ])->assertOk();

        $this->userDisk($alice)->assertExists('Projects/doc.txt');
    }

    public function test_grantee_with_write_can_rename_within_the_grant(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->userDisk($alice)->put('Projects/old.txt', 'x');
        $g = $this->grant($alice, $bob, 'Projects', 'write');

        $this->actingAs($bob)->post("/shared/{$g->id}/rename", ['path' => 'Projects/old.txt', 'name' => 'new.txt'])
            ->assertRedirect();

        $this->userDisk($alice)->assertMissing('Projects/old.txt');
        $this->userDisk($alice)->assertExists('Projects/new.txt');
    }

    public function test_grantee_with_write_can_delete_into_the_owner_trash(): void
    {
        Storage::fake('local');
        Storage::fake('trash');
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->userDisk($alice)->put('Projects/gone.txt', 'x');
        $g = $this->grant($alice, $bob, 'Projects', 'write');

        $this->actingAs($bob)->deleteJson("/shared/{$g->id}", ['path' => 'Projects/gone.txt'])
            ->assertOk();

        $this->userDisk($alice)->assertMissing('Projects/gone.txt');
        // Trashed under the OWNER, so the owner (not the grantee) can restore it.
        $this->assertDatabaseHas('trashed_items', ['deleted_by' => $alice->id, 'original_path' => 'Projects/gone.txt']);
    }

    public function test_read_only_grant_rejects_writes(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->userDisk($alice)->put('Projects/a.txt', 'x');
        $g = $this->grant($alice, $bob, 'Projects', 'read');

        $this->actingAs($bob)->post("/shared/{$g->id}/folders", ['path' => 'Projects', 'name' => 'Sub'])->assertForbidden();
        $this->actingAs($bob)->post("/shared/{$g->id}/rename", ['path' => 'Projects/a.txt', 'name' => 'b.txt'])->assertForbidden();
        $this->actingAs($bob)->deleteJson("/shared/{$g->id}", ['path' => 'Projects/a.txt'])->assertForbidden();
    }

    public function test_writes_cannot_escape_the_subtree(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->userDisk($alice)->put('Projects/a.txt', 'x');
        $this->userDisk($alice)->put('secret.txt', 'nope');
        $g = $this->grant($alice, $bob, 'Projects', 'write');

        // Try to delete a sibling outside the grant.
        $this->actingAs($bob)->deleteJson("/shared/{$g->id}", ['path' => 'secret.txt'])->assertForbidden();
        $this->userDisk($alice)->assertExists('secret.txt');
    }

    public function test_upload_respects_the_owner_quota(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser('admin', 1500); // tiny owner quota: 1500 bytes
        $bob = $this->makeUser();
        $this->userDisk($alice)->put('Projects/existing.bin', str_repeat('x', 1000));
        $g = $this->grant($alice, $bob, 'Projects', 'write');

        // 1000 used + ~1024 incoming > 1500 → rejected against the OWNER's quota.
        $this->actingAs($bob)->post("/shared/{$g->id}/upload", [
            'path' => 'Projects',
            'file' => UploadedFile::fake()->create('big.bin', 1), // 1 KB
        ])->assertStatus(422);

        $this->userDisk($alice)->assertMissing('Projects/big.bin');
    }
}
