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
 * Phase B: a grantee reads shared files/folders from the owner's partition,
 * confined to the granted subtree.
 */
class SharedAccessTest extends TestCase
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

    private function grant(User $owner, User $grantee, string $path, string $permission = 'read'): FileGrant
    {
        return FileGrant::create([
            'owner_id' => $owner->id, 'grantee_id' => $grantee->id, 'path' => $path, 'permission' => $permission,
        ]);
    }

    public function test_shared_with_me_lists_my_grants(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->userDisk($alice)->makeDirectory('Projects');
        $this->grant($alice, $bob, 'Projects');

        $this->actingAs($bob)->get('/shared')->assertOk();
    }

    public function test_grantee_can_list_a_shared_folder(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->userDisk($alice)->put('Projects/a.txt', 'a');
        $this->userDisk($alice)->put('Projects/b.txt', 'b');
        $this->userDisk($alice)->put('secret.txt', 'nope'); // outside the grant
        $grant = $this->grant($alice, $bob, 'Projects');

        $this->actingAs($bob)->getJson("/shared/{$grant->id}/list")
            ->assertOk()
            ->assertJsonFragment(['name' => 'a.txt'])
            ->assertJsonFragment(['name' => 'b.txt'])
            ->assertJsonMissing(['name' => 'secret.txt']);
    }

    public function test_grantee_can_download_a_shared_file(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->userDisk($alice)->put('report.pdf', 'pdf-bytes');
        $grant = $this->grant($alice, $bob, 'report.pdf');

        $this->actingAs($bob)->get("/shared/{$grant->id}/download?path=report.pdf")
            ->assertOk()
            ->assertDownload('report.pdf');
    }

    public function test_grantee_cannot_escape_the_granted_subtree(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->userDisk($alice)->put('Projects/a.txt', 'a');
        $this->userDisk($alice)->put('secret.txt', 'nope');
        $grant = $this->grant($alice, $bob, 'Projects');

        // A sibling path outside the grant must be refused.
        $this->actingAs($bob)->getJson("/shared/{$grant->id}/list?path=".urlencode('secret.txt'))->assertForbidden();
        $this->actingAs($bob)->get("/shared/{$grant->id}/download?path=".urlencode('../secret.txt'))->assertForbidden();
    }

    public function test_non_grantee_cannot_access_a_grant(): void
    {
        Storage::fake('local');
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $carol = $this->makeUser();
        $this->userDisk($alice)->put('Projects/a.txt', 'a');
        $grant = $this->grant($alice, $bob, 'Projects');

        $this->actingAs($carol)->getJson("/shared/{$grant->id}/list")->assertNotFound();
    }
}
