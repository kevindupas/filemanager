<?php

namespace Tests\Feature;

use App\Models\FileVersion;
use App\Models\User;
use App\Services\FileManager;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class VersionTest extends TestCase
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
    }

    private function admin(): User
    {
        $u = User::factory()->create();
        $u->assignRole('admin');

        return $u;
    }

    private function disk(User $u): Filesystem
    {
        return Storage::build([
            'driver' => 'local',
            'root' => Storage::disk('local')->path('users/'.$u->id),
            'throw' => false,
        ]);
    }

    public function test_saving_snapshots_the_previous_version(): void
    {
        $u = $this->admin();
        $this->disk($u)->put('note.txt', 'v1');

        $this->actingAs($u)->post('/files/save', ['path' => 'note.txt', 'content' => 'v2'])->assertOk();

        $this->assertSame('v2', $this->disk($u)->get('note.txt'));
        $this->assertDatabaseHas('file_versions', ['owner_id' => $u->id, 'path' => 'note.txt', 'size' => 2]);
        $this->assertSame(1, FileVersion::count());
    }

    public function test_versions_endpoint_lists_history(): void
    {
        $u = $this->admin();
        $this->disk($u)->put('note.txt', 'v1');
        $this->actingAs($u)->post('/files/save', ['path' => 'note.txt', 'content' => 'v2']);

        $this->actingAs($u)->getJson('/files/versions?path=note.txt')
            ->assertOk()
            ->assertJsonCount(1);
    }

    public function test_a_version_can_be_downloaded(): void
    {
        $u = $this->admin();
        $this->disk($u)->put('note.txt', 'old-bytes');
        $this->actingAs($u)->post('/files/save', ['path' => 'note.txt', 'content' => 'new-bytes']);
        $v = FileVersion::first();

        $res = $this->actingAs($u)->get("/files/versions/download?path=note.txt&version={$v->id}");
        $res->assertOk();
        $this->assertSame('old-bytes', $res->streamedContent());
    }

    public function test_restoring_a_version_brings_back_old_content_and_snapshots_current(): void
    {
        $u = $this->admin();
        $this->disk($u)->put('note.txt', 'v1');
        $this->actingAs($u)->post('/files/save', ['path' => 'note.txt', 'content' => 'v2']);
        $v1 = FileVersion::first();

        $this->actingAs($u)->post('/files/versions/restore', ['path' => 'note.txt', 'version' => $v1->id])->assertOk();

        $this->assertSame('v1', $this->disk($u)->get('note.txt'));
        // The 'v2' bytes were snapshotted before restoring, so history grew.
        $this->assertSame(2, FileVersion::count());
    }

    public function test_old_versions_are_pruned_to_the_cap(): void
    {
        config(['filemanager.max_versions' => 2]);
        $u = $this->admin();
        $this->disk($u)->put('note.txt', 'v1');

        foreach (['v2', 'v3', 'v4', 'v5'] as $content) {
            $this->actingAs($u)->post('/files/save', ['path' => 'note.txt', 'content' => $content]);
        }

        $this->assertSame(2, FileVersion::where('path', 'note.txt')->count());
    }

    public function test_versions_count_toward_used_storage(): void
    {
        $u = $this->admin();
        $this->disk($u)->put('note.txt', 'aaa'); // 3 bytes
        $this->actingAs($u)->post('/files/save', ['path' => 'note.txt', 'content' => 'bbbb']); // 4 bytes; snapshots 'aaa'

        $this->actingAs($u);
        // 4 (current) + 3 (stored version) = 7
        $this->assertSame(7, app(FileManager::class)->usedBytes());
    }
}
