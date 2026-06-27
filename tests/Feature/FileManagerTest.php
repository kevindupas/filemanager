<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class FileManagerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Minimal role/permission model, mirrors the seeder.
        foreach (['manage-users', 'upload-files', 'delete-files', 'create-folders', 'share-files'] as $p) {
            Permission::firstOrCreate(['name' => $p]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions(Permission::all());
        Role::firstOrCreate(['name' => 'user']);

        Storage::fake('local');
        Storage::fake('trash');
        Storage::fake('thumbs');
    }

    private function makeUser(string $role = 'user'): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    /**
     * The given user's private partition — a subdirectory of the (faked) local
     * disk, matching how UserStorage confines each account in production.
     */
    private function userDisk(User $user): Filesystem
    {
        return Storage::build([
            'driver' => 'local',
            'root' => Storage::disk('local')->path('users/'.$user->id),
            'throw' => false,
        ]);
    }

    public function test_guests_are_redirected_from_the_browser(): void
    {
        $this->get('/files')->assertRedirect('/login');
    }

    public function test_any_authenticated_user_can_browse(): void
    {
        $user = $this->makeUser();
        $this->userDisk($user)->makeDirectory('Documents');

        $this->actingAs($user)->get('/files')->assertOk();
    }

    public function test_path_traversal_is_confined_to_the_root(): void
    {
        // "../../etc/passwd" must collapse to "etc/passwd" under the root,
        // which does not exist — proving it never reached the real /etc.
        $this->actingAs($this->makeUser())
            ->getJson('/files?path='.urlencode('../../etc/passwd'))
            ->assertStatus(404);
    }

    public function test_dotdot_navigation_collapses_to_root(): void
    {
        $this->actingAs($this->makeUser())
            ->get('/files?path='.urlencode('../../'))
            ->assertOk();
    }

    public function test_folder_creation_requires_permission(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)
            ->post('/files/folders', ['name' => 'NewDir', 'path' => ''])
            ->assertForbidden();

        $this->userDisk($user)->assertMissing('NewDir');
    }

    public function test_folder_creation_works_with_permission(): void
    {
        $admin = $this->makeUser('admin');

        $this->actingAs($admin)
            ->post('/files/folders', ['name' => 'NewDir', 'path' => '']);

        $this->userDisk($admin)->assertExists('NewDir');
    }

    public function test_deletion_requires_permission(): void
    {
        $user = $this->makeUser();
        $this->userDisk($user)->put('keep.txt', 'data');

        $this->actingAs($user)
            ->delete('/files', ['path' => 'keep.txt'])
            ->assertForbidden();

        $this->userDisk($user)->assertExists('keep.txt');
    }

    public function test_deletion_works_with_permission(): void
    {
        $admin = $this->makeUser('admin');
        $this->userDisk($admin)->put('gone.txt', 'data');

        $this->actingAs($admin)
            ->delete('/files', ['path' => 'gone.txt']);

        $this->userDisk($admin)->assertMissing('gone.txt');
    }

    public function test_download_streams_to_any_authenticated_user(): void
    {
        $user = $this->makeUser();
        $this->userDisk($user)->put('hello.txt', 'hello world');

        $response = $this->actingAs($user)->get('/files/download?path=hello.txt');

        $response->assertOk();
        $response->assertDownload('hello.txt');
    }

    public function test_dotfiles_are_hidden_from_the_listing(): void
    {
        $user = $this->makeUser();
        $this->userDisk($user)->put('.gitignore', '*');
        $this->userDisk($user)->put('visible.txt', 'hi');

        $this->actingAs($user);
        $listing = app(\App\Services\FileManager::class)->list('');
        $names = array_column($listing['entries'], 'name');

        $this->assertContains('visible.txt', $names);
        $this->assertNotContains('.gitignore', $names);
    }

    public function test_preview_streams_a_file_inline(): void
    {
        $user = $this->makeUser();
        $this->userDisk($user)->put('photo.txt', 'inline-bytes');

        $response = $this->actingAs($user)->get('/files/preview?path=photo.txt');

        $response->assertOk();
        $this->assertStringContainsString('inline', $response->headers->get('Content-Disposition'));
    }

    public function test_info_returns_file_metadata(): void
    {
        $user = $this->makeUser();
        $this->userDisk($user)->put('doc.txt', 'metadata please');

        $this->actingAs($user)
            ->getJson('/files/info?path=doc.txt')
            ->assertOk()
            ->assertJson([
                'name' => 'doc.txt',
                'type' => 'file',
                'size' => 15,
                'extension' => 'txt',
                'sha256' => hash('sha256', 'metadata please'),
            ])
            ->assertJsonStructure(['permissions', 'readable', 'writable', 'modified', 'mime']);
    }

    public function test_info_returns_folder_counts(): void
    {
        $user = $this->makeUser();
        $this->userDisk($user)->put('proj/a.txt', 'a');
        $this->userDisk($user)->put('proj/sub/b.txt', 'bb');

        $this->actingAs($user)
            ->getJson('/files/info?path=proj')
            ->assertOk()
            ->assertJson(['type' => 'dir', 'fileCount' => 2, 'folderCount' => 1, 'size' => 3]);
    }

    public function test_move_relocates_a_file(): void
    {
        $user = $this->makeUser();
        $disk = $this->userDisk($user);
        $disk->put('a.txt', 'x');
        $disk->makeDirectory('dest');

        $this->actingAs($user)
            ->post('/files/move', ['paths' => ['a.txt'], 'destination' => 'dest']);

        $disk->assertMissing('a.txt');
        $disk->assertExists('dest/a.txt');
    }

    public function test_copy_suffixes_on_collision(): void
    {
        $user = $this->makeUser();
        $disk = $this->userDisk($user);
        $disk->put('note.txt', 'one');
        $disk->makeDirectory('dest');
        $disk->put('dest/note.txt', 'existing');

        $this->actingAs($user)
            ->post('/files/copy', ['paths' => ['note.txt'], 'destination' => 'dest']);

        $disk->assertExists('dest/note.txt');       // untouched
        $disk->assertExists('dest/note (copy).txt'); // suffixed copy
        $this->assertSame('existing', $disk->get('dest/note.txt'));
    }

    public function test_cannot_move_folder_into_its_descendant(): void
    {
        $user = $this->makeUser();
        $disk = $this->userDisk($user);
        $disk->makeDirectory('parent/child');

        $this->actingAs($user)
            ->post('/files/move', ['paths' => ['parent'], 'destination' => 'parent/child']);

        // Guard kept the folder where it was.
        $disk->assertExists('parent/child');
        $disk->assertMissing('parent/child/parent');
    }

    public function test_recursive_search_finds_nested_matches(): void
    {
        $user = $this->makeUser();
        $disk = $this->userDisk($user);
        $disk->put('top/deep/report-2026.txt', 'x');
        $disk->put('top/other.txt', 'x');

        $this->actingAs($user);
        $listing = app(\App\Services\FileManager::class)->search('', 'report');
        $names = array_column($listing['entries'], 'name');

        $this->assertContains('report-2026.txt', $names);
        $this->assertNotContains('other.txt', $names);
    }

    public function test_bulk_delete_removes_multiple(): void
    {
        $admin = $this->makeUser('admin');
        $disk = $this->userDisk($admin);
        $disk->put('one.txt', 'a');
        $disk->put('two.txt', 'b');

        $this->actingAs($admin)
            ->delete('/files', ['paths' => ['one.txt', 'two.txt']]);

        $disk->assertMissing('one.txt');
        $disk->assertMissing('two.txt');
    }

    public function test_dirs_returns_only_subdirectories(): void
    {
        $user = $this->makeUser();
        $disk = $this->userDisk($user);
        $disk->makeDirectory('folderA');
        $disk->put('loose.txt', 'x');

        $this->actingAs($user)
            ->getJson('/files/dirs?path=')
            ->assertOk()
            ->assertJsonFragment(['name' => 'folderA'])
            ->assertJsonMissing(['name' => 'loose.txt']);
    }

    // --- trash ---

    public function test_delete_moves_to_trash_and_can_be_restored(): void
    {
        $admin = $this->makeUser('admin');
        $disk = $this->userDisk($admin);
        $disk->put('keep.txt', 'data');

        $this->actingAs($admin)->delete('/files', ['paths' => ['keep.txt']]);

        $disk->assertMissing('keep.txt');
        $this->assertDatabaseCount('trashed_items', 1);

        $item = \App\Models\TrashedItem::first();
        $this->actingAs($admin)->post("/trash/{$item->id}/restore");

        $disk->assertExists('keep.txt');
        $this->assertDatabaseCount('trashed_items', 0);
    }

    public function test_purge_permanently_removes_a_trashed_item(): void
    {
        $admin = $this->makeUser('admin');
        $this->userDisk($admin)->put('bye.txt', 'x');

        $this->actingAs($admin)->delete('/files', ['paths' => ['bye.txt']]);
        $item = \App\Models\TrashedItem::first();
        $this->actingAs($admin)->delete("/trash/{$item->id}");

        $this->assertDatabaseCount('trashed_items', 0);
    }

    public function test_trash_page_requires_delete_permission(): void
    {
        $this->actingAs($this->makeUser('user'))->get('/trash')->assertForbidden();
        $this->actingAs($this->makeUser('admin'))->get('/trash')->assertOk();
    }

    // --- shares ---

    public function test_share_creation_requires_share_files_permission(): void
    {
        $user = $this->makeUser('user');
        $this->userDisk($user)->put('doc.pdf', 'x');

        $this->actingAs($user)
            ->postJson('/shares', ['path' => 'doc.pdf'])
            ->assertForbidden();

        $admin = $this->makeUser('admin');
        $this->userDisk($admin)->put('doc.pdf', 'x');

        $this->actingAs($admin)
            ->postJson('/shares', ['path' => 'doc.pdf'])
            ->assertCreated()
            ->assertJsonStructure(['id', 'url', 'has_password']);
    }

    public function test_cannot_share_a_directory(): void
    {
        $admin = $this->makeUser('admin');
        $this->userDisk($admin)->makeDirectory('folder');

        $this->actingAs($admin)
            ->postJson('/shares', ['path' => 'folder'])
            ->assertStatus(422);
    }

    public function test_public_can_download_a_shared_file(): void
    {
        $owner = $this->makeUser('admin');
        $this->userDisk($owner)->put('pub.txt', 'public bytes');
        $share = \App\Models\FileShare::create([
            'token' => 'tok123', 'path' => 'pub.txt', 'name' => 'pub.txt', 'created_by' => $owner->id,
        ]);

        $this->get("/s/{$share->token}/download")->assertOk()->assertDownload('pub.txt');
    }

    public function test_expired_share_is_blocked(): void
    {
        $owner = $this->makeUser('admin');
        $this->userDisk($owner)->put('old.txt', 'x');
        $share = \App\Models\FileShare::create([
            'token' => 'expiredtok', 'path' => 'old.txt', 'name' => 'old.txt',
            'created_by' => $owner->id, 'expires_at' => now()->subDay(),
        ]);

        $this->get("/s/{$share->token}/download")->assertStatus(410);
    }

    public function test_password_protected_share_blocks_without_unlock(): void
    {
        $owner = $this->makeUser('admin');
        $this->userDisk($owner)->put('secret.txt', 'x');
        $share = \App\Models\FileShare::create([
            'token' => 'pwtok', 'path' => 'secret.txt', 'name' => 'secret.txt', 'created_by' => $owner->id,
            'password' => \Illuminate\Support\Facades\Hash::make('hunter2'),
        ]);

        $this->get("/s/{$share->token}/download")->assertStatus(403);
    }

    // --- zip / thumbnails / activity ---

    public function test_zip_streams_selected_paths(): void
    {
        $user = $this->makeUser();
        $disk = $this->userDisk($user);
        $disk->put('a.txt', 'aaa');
        $disk->put('folder/b.txt', 'bbb');

        $response = $this->actingAs($user)
            ->get('/files/zip?'.http_build_query(['paths' => ['a.txt', 'folder']]));

        $response->assertOk();
        $this->assertSame('application/zip', $response->headers->get('Content-Type'));
    }

    public function test_thumbnail_returns_404_for_non_images(): void
    {
        $user = $this->makeUser();
        $this->userDisk($user)->put('notes.txt', 'x');

        $this->actingAs($user)->get('/files/thumb?path=notes.txt')->assertStatus(404);
    }

    public function test_thumbnail_is_generated_for_an_image(): void
    {
        $user = $this->makeUser();
        $gd = imagecreatetruecolor(20, 20);
        ob_start();
        imagejpeg($gd);
        $this->userDisk($user)->put('pic.jpg', ob_get_clean());
        imagedestroy($gd);

        $response = $this->actingAs($user)->get('/files/thumb?path=pic.jpg');

        $response->assertOk();
        $this->assertSame('image/jpeg', $response->headers->get('Content-Type'));
    }

    public function test_actions_are_recorded_in_the_activity_log(): void
    {
        $this->actingAs($this->makeUser('admin'))
            ->post('/files/folders', ['name' => 'Logged', 'path' => '']);

        $this->assertDatabaseHas('activity_log', ['event' => 'created-folder']);
    }

    public function test_activity_page_is_open_to_any_authenticated_user(): void
    {
        // Activity is now per-user (scoped to the caller); admins can widen it.
        $this->actingAs($this->makeUser('user'))->get('/activity')->assertOk();
        $this->actingAs($this->makeUser('admin'))->get('/activity')->assertOk();
    }

    // --- favorites ---

    public function test_favorite_toggle_adds_then_removes(): void
    {
        $user = $this->makeUser();
        $this->userDisk($user)->put('star.txt', 'x');

        $this->actingAs($user)->postJson('/favorites/toggle', ['path' => 'star.txt'])
            ->assertOk()->assertJson(['favorited' => true]);
        $this->assertDatabaseHas('favorites', ['user_id' => $user->id, 'path' => 'star.txt']);

        $this->actingAs($user)->postJson('/favorites/toggle', ['path' => 'star.txt'])
            ->assertOk()->assertJson(['favorited' => false]);
        $this->assertDatabaseMissing('favorites', ['user_id' => $user->id, 'path' => 'star.txt']);
    }

    public function test_favorites_page_loads(): void
    {
        $this->actingAs($this->makeUser())->get('/favorites')->assertOk();
    }

    public function test_quota_detects_overage(): void
    {
        $user = $this->makeUser();
        $this->userDisk($user)->put('a.bin', str_repeat('x', 2000));
        $this->actingAs($user);
        $fm = app(\App\Services\FileManager::class);

        config(['filemanager.quota_gb' => 2500 / 1024 ** 3]); // 2500 bytes
        $this->assertFalse($fm->exceedsQuota(400));  // 2000 + 400 < 2500
        $this->assertTrue($fm->exceedsQuota(800));   // 2000 + 800 > 2500
    }

    public function test_quota_zero_means_unlimited(): void
    {
        $user = $this->makeUser();
        $this->userDisk($user)->put('a.bin', str_repeat('x', 2000));
        config(['filemanager.quota_gb' => 0]);

        $this->actingAs($user);
        $this->assertFalse(app(\App\Services\FileManager::class)->exceedsQuota(PHP_INT_MAX - 1));
    }

    // --- cross-disk transfer mechanics ---

    public function test_copy_across_streams_a_file_between_disks(): void
    {
        $a = Storage::fake('local');
        $b = Storage::fake('thumbs'); // stand-in for a second disk
        $a->put('hello.txt', 'cross-disk bytes');

        app(\App\Services\FileManager::class)->copyAcross($a, $b, 'hello.txt', 'hello.txt', false);

        $b->assertExists('hello.txt');
        $this->assertSame('cross-disk bytes', $b->get('hello.txt'));
    }

    public function test_copy_across_recurses_directories(): void
    {
        $a = Storage::fake('local');
        $b = Storage::fake('thumbs');
        $a->put('proj/sub/file.txt', 'x');

        $fm = app(\App\Services\FileManager::class);
        $fm->copyAcross($a, $b, 'proj', 'proj', true);

        $b->assertExists('proj/sub/file.txt');
    }

    public function test_unique_name_on_avoids_collisions(): void
    {
        $b = Storage::fake('thumbs');
        $b->put('note.txt', 'x');

        $name = app(\App\Services\FileManager::class)->uniqueNameOn($b, 'note.txt');
        $this->assertSame('note (copy).txt', $name);
    }

    public function test_admin_users_page_requires_manage_users(): void
    {
        $this->actingAs($this->makeUser('user'))->get('/admin/users')->assertForbidden();
        $this->actingAs($this->makeUser('admin'))->get('/admin/users')->assertOk();
    }

    public function test_pulse_is_gated_behind_the_admin_role(): void
    {
        $this->assertTrue(Gate::forUser($this->makeUser('admin'))->allows('viewPulse'));
        $this->assertFalse(Gate::forUser($this->makeUser('user'))->allows('viewPulse'));
    }

    public function test_save_writes_edited_text(): void
    {
        $admin = $this->makeUser('admin');
        $this->userDisk($admin)->put('note.txt', 'old');

        $this->actingAs($admin)
            ->post('/files/save', ['path' => 'note.txt', 'content' => 'edited content'])
            ->assertOk();

        $this->assertSame('edited content', $this->userDisk($admin)->get('note.txt'));
    }

    public function test_save_requires_upload_permission(): void
    {
        $user = $this->makeUser('user'); // no upload-files permission
        $this->userDisk($user)->put('note.txt', 'old');

        $this->actingAs($user)
            ->post('/files/save', ['path' => 'note.txt', 'content' => 'x'])
            ->assertForbidden();

        $this->assertSame('old', $this->userDisk($user)->get('note.txt'));
    }
}
