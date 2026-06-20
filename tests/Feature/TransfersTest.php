<?php

namespace Tests\Feature;

use App\Jobs\ProcessTransfer;
use App\Models\Transfer;
use App\Models\User;
use App\Services\DiskResolver;
use App\Services\FileManager;
use App\Services\TrashManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TransfersTest extends TestCase
{
    use RefreshDatabase;

    public function test_job_copies_a_tree_and_marks_done(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('src/a.txt', 'a');
        Storage::disk('local')->put('src/sub/b.txt', 'bb');

        $user = User::factory()->create();
        $t = Transfer::create([
            'user_id' => $user->id,
            'mode' => 'copy',
            'source_disk' => 'local',
            'dest_disk' => 'local',
            'destination' => 'dest',
            'paths' => ['src'],
        ]);

        (new ProcessTransfer($t->id))->handle(app(DiskResolver::class), app(FileManager::class), app(TrashManager::class));

        $t->refresh();
        $this->assertSame('done', $t->status);
        $this->assertSame(2, $t->total_files);
        Storage::disk('local')->assertExists('dest/src/a.txt');
        Storage::disk('local')->assertExists('dest/src/sub/b.txt');
    }

    public function test_job_move_removes_source(): void
    {
        Storage::fake('local');
        Storage::fake('trash');
        Storage::disk('local')->put('gone.txt', 'x');

        $user = User::factory()->create();
        $t = Transfer::create([
            'user_id' => $user->id, 'mode' => 'move', 'source_disk' => 'local',
            'dest_disk' => 'local', 'destination' => 'dest', 'paths' => ['gone.txt'],
        ]);

        (new ProcessTransfer($t->id))->handle(app(DiskResolver::class), app(FileManager::class), app(TrashManager::class));

        Storage::disk('local')->assertExists('dest/gone.txt');
        Storage::disk('local')->assertMissing('gone.txt'); // moved (trashed) from source
    }

    public function test_check_transfer_reports_existing_targets(): void
    {
        Storage::fake('local');
        Storage::disk('local')->makeDirectory('dest');
        Storage::disk('local')->put('dest/a.txt', 'x');
        Storage::disk('local')->put('a.txt', 'y');
        Storage::disk('local')->put('b.txt', 'z');

        $this->actingAs(User::factory()->create())
            ->postJson('/files/transfer/check', ['paths' => ['a.txt', 'b.txt'], 'destination' => 'dest'])
            ->assertOk()
            ->assertJsonPath('conflicts.0.name', 'a.txt')
            ->assertJsonCount(1, 'conflicts');
    }

    public function test_move_overwrite_replaces_existing(): void
    {
        Storage::fake('local');
        Storage::fake('trash');
        Storage::disk('local')->makeDirectory('dest');
        Storage::disk('local')->put('dest/a.txt', 'old');
        Storage::disk('local')->put('a.txt', 'new');

        $this->actingAs(User::factory()->create())
            ->post('/files/move', ['paths' => ['a.txt'], 'destination' => 'dest', 'resolutions' => ['a.txt' => 'overwrite']]);

        $this->assertSame('new', Storage::disk('local')->get('dest/a.txt'));
        Storage::disk('local')->assertMissing('a.txt');
    }

    public function test_move_skip_keeps_both(): void
    {
        Storage::fake('local');
        Storage::fake('trash');
        Storage::disk('local')->makeDirectory('dest');
        Storage::disk('local')->put('dest/a.txt', 'old');
        Storage::disk('local')->put('a.txt', 'new');

        $this->actingAs(User::factory()->create())
            ->post('/files/move', ['paths' => ['a.txt'], 'destination' => 'dest', 'resolutions' => ['a.txt' => 'skip']]);

        $this->assertSame('old', Storage::disk('local')->get('dest/a.txt')); // untouched
        Storage::disk('local')->assertExists('a.txt'); // source kept
    }

    public function test_job_overwrite_replaces_target(): void
    {
        Storage::fake('local');
        Storage::disk('local')->makeDirectory('dest');
        Storage::disk('local')->put('dest/a.txt', 'old');
        Storage::disk('local')->put('a.txt', 'new');

        $user = User::factory()->create();
        $t = Transfer::create([
            'user_id' => $user->id, 'mode' => 'copy', 'source_disk' => 'local',
            'dest_disk' => 'local', 'destination' => 'dest', 'paths' => ['a.txt'],
            'resolutions' => ['a.txt' => 'overwrite'],
        ]);

        (new ProcessTransfer($t->id))->handle(app(DiskResolver::class), app(FileManager::class), app(TrashManager::class));

        $this->assertSame('new', Storage::disk('local')->get('dest/a.txt'));
        Storage::disk('local')->assertMissing('dest/a.txt.fmpart-'.substr(md5('dest/a.txt'), 0, 8)); // temp cleaned up
    }

    public function test_transfers_feed_is_scoped_to_user(): void
    {
        $me = User::factory()->create();
        $other = User::factory()->create();
        Transfer::create(['user_id' => $me->id, 'mode' => 'copy', 'source_disk' => 'local', 'dest_disk' => 'conn_1', 'destination' => '', 'paths' => ['x'], 'status' => 'running']);
        Transfer::create(['user_id' => $other->id, 'mode' => 'copy', 'source_disk' => 'local', 'dest_disk' => 'conn_2', 'destination' => '', 'paths' => ['y'], 'status' => 'running']);

        $this->actingAs($me)->getJson('/transfers')->assertOk()->assertJsonCount(1);
    }
}
