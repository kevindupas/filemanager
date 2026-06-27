<?php

namespace Tests\Feature;

use App\Jobs\ProcessTransfer;
use App\Models\Transfer;
use App\Models\User;
use App\Services\DiskResolver;
use App\Services\FileManager;
use App\Services\TrashManager;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TransfersTest extends TestCase
{
    use RefreshDatabase;

    /** A user's private partition under the (faked) local disk. */
    private function userDisk(User $user): Filesystem
    {
        return Storage::build([
            'driver' => 'local',
            'root' => Storage::disk('local')->path('users/'.$user->id),
            'throw' => false,
        ]);
    }

    public function test_job_copies_a_tree_and_marks_done(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $disk = $this->userDisk($user);
        $disk->put('src/a.txt', 'a');
        $disk->put('src/sub/b.txt', 'bb');

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
        $disk->assertExists('dest/src/a.txt');
        $disk->assertExists('dest/src/sub/b.txt');
    }

    public function test_job_move_removes_source(): void
    {
        Storage::fake('local');
        Storage::fake('trash');
        $user = User::factory()->create();
        $disk = $this->userDisk($user);
        $disk->put('gone.txt', 'x');

        $t = Transfer::create([
            'user_id' => $user->id, 'mode' => 'move', 'source_disk' => 'local',
            'dest_disk' => 'local', 'destination' => 'dest', 'paths' => ['gone.txt'],
        ]);

        (new ProcessTransfer($t->id))->handle(app(DiskResolver::class), app(FileManager::class), app(TrashManager::class));

        $disk->assertExists('dest/gone.txt');
        $disk->assertMissing('gone.txt'); // moved (trashed) from source
    }

    public function test_check_transfer_reports_existing_targets(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $disk = $this->userDisk($user);
        $disk->makeDirectory('dest');
        $disk->put('dest/a.txt', 'x');
        $disk->put('a.txt', 'y');
        $disk->put('b.txt', 'z');

        $this->actingAs($user)
            ->postJson('/files/transfer/check', ['paths' => ['a.txt', 'b.txt'], 'destination' => 'dest'])
            ->assertOk()
            ->assertJsonPath('conflicts.0.name', 'a.txt')
            ->assertJsonCount(1, 'conflicts');
    }

    public function test_move_overwrite_replaces_existing(): void
    {
        Storage::fake('local');
        Storage::fake('trash');
        $user = User::factory()->create();
        $disk = $this->userDisk($user);
        $disk->makeDirectory('dest');
        $disk->put('dest/a.txt', 'old');
        $disk->put('a.txt', 'new');

        $this->actingAs($user)
            ->post('/files/move', ['paths' => ['a.txt'], 'destination' => 'dest', 'resolutions' => ['a.txt' => 'overwrite']]);

        $this->assertSame('new', $disk->get('dest/a.txt'));
        $disk->assertMissing('a.txt');
    }

    public function test_move_skip_keeps_both(): void
    {
        Storage::fake('local');
        Storage::fake('trash');
        $user = User::factory()->create();
        $disk = $this->userDisk($user);
        $disk->makeDirectory('dest');
        $disk->put('dest/a.txt', 'old');
        $disk->put('a.txt', 'new');

        $this->actingAs($user)
            ->post('/files/move', ['paths' => ['a.txt'], 'destination' => 'dest', 'resolutions' => ['a.txt' => 'skip']]);

        $this->assertSame('old', $disk->get('dest/a.txt')); // untouched
        $disk->assertExists('a.txt'); // source kept
    }

    public function test_job_overwrite_replaces_target(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $disk = $this->userDisk($user);
        $disk->makeDirectory('dest');
        $disk->put('dest/a.txt', 'old');
        $disk->put('a.txt', 'new');

        $t = Transfer::create([
            'user_id' => $user->id, 'mode' => 'copy', 'source_disk' => 'local',
            'dest_disk' => 'local', 'destination' => 'dest', 'paths' => ['a.txt'],
            'resolutions' => ['a.txt' => 'overwrite'],
        ]);

        (new ProcessTransfer($t->id))->handle(app(DiskResolver::class), app(FileManager::class), app(TrashManager::class));

        $this->assertSame('new', $disk->get('dest/a.txt'));
        $disk->assertMissing('dest/a.txt.fmpart-'.substr(md5('dest/a.txt'), 0, 8)); // temp cleaned up
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
