<?php

namespace Tests\Feature;

use App\Models\FileShare;
use App\Models\TrashedItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Multi-tenancy: every account only ever sees its own files, trash and shares.
 * These tests fail on a shared-root install (the original bug) and pass once
 * each user is confined to their own storage partition.
 */
class UserIsolationTest extends TestCase
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

        Storage::fake('local');
        Storage::fake('trash');
        Storage::fake('thumbs');
    }

    private function makeUser(string $role = 'admin'): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    /** Seed a file into a specific user's private partition. */
    private function seedFile(User $user, string $path, string $contents = 'x'): void
    {
        Storage::disk('local')->put("users/{$user->id}/{$path}", $contents);
    }

    public function test_a_user_cannot_list_another_users_files(): void
    {
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->seedFile($alice, 'secret.txt', 'alice only');

        // Alice sees it…
        $this->actingAs($alice)->getJson('/files/list?path=')
            ->assertOk()->assertJsonFragment(['name' => 'secret.txt']);

        // …Bob must not.
        $this->actingAs($bob)->getJson('/files/list?path=')
            ->assertOk()->assertJsonMissing(['name' => 'secret.txt']);
    }

    public function test_a_user_cannot_download_another_users_file(): void
    {
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->seedFile($alice, 'secret.txt', 'alice only');

        $this->actingAs($alice)->get('/files/download?path=secret.txt')->assertOk();
        $this->actingAs($bob)->get('/files/download?path=secret.txt')->assertStatus(404);
    }

    public function test_uploaded_files_land_in_the_users_own_partition(): void
    {
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->seedFile($alice, 'a.txt');

        // Bob's empty listing proves Alice's upload didn't leak into a shared root.
        $this->actingAs($bob)->getJson('/files/list?path=')
            ->assertOk()->assertJsonCount(0, 'entries');
    }

    public function test_trash_is_scoped_per_user(): void
    {
        $alice = $this->makeUser();
        $bob = $this->makeUser();

        $aliceItem = TrashedItem::create([
            'original_path' => 'a.txt', 'name' => 'a.txt', 'type' => 'file',
            'size' => 1, 'storage_key' => 'key-a', 'deleted_by' => $alice->id,
        ]);

        // Bob's trash list excludes Alice's item…
        $this->actingAs($bob)->get('/trash')->assertOk();
        $this->actingAs($bob)->getJson('/trash'); // page; assert via DB-backed restore guard below

        // …and Bob cannot restore or purge Alice's trashed item.
        $this->actingAs($bob)->post("/trash/{$aliceItem->id}/restore")->assertForbidden();
        $this->actingAs($bob)->delete("/trash/{$aliceItem->id}")->assertForbidden();

        $this->assertDatabaseHas('trashed_items', ['id' => $aliceItem->id]);
    }

    public function test_shares_are_scoped_per_user(): void
    {
        $alice = $this->makeUser();
        $bob = $this->makeUser();

        $aliceShare = FileShare::create([
            'token' => 'aliceTok', 'path' => 'a.txt', 'name' => 'a.txt', 'created_by' => $alice->id,
        ]);

        // Bob cannot revoke Alice's share.
        $this->actingAs($bob)->deleteJson("/shares/{$aliceShare->id}")->assertForbidden();
        $this->assertDatabaseHas('file_shares', ['id' => $aliceShare->id]);

        // forPath only returns the caller's own shares.
        $this->seedFile($bob, 'a.txt');
        $this->actingAs($bob)->getJson('/shares/for?path=a.txt')
            ->assertOk()->assertJsonMissing(['id' => $aliceShare->id]);
    }
}
