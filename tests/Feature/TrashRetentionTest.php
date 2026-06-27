<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\TrashedItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrashRetentionTest extends TestCase
{
    use RefreshDatabase;

    private function trashed(User $owner, string $name, int $ageDays): TrashedItem
    {
        $item = TrashedItem::create([
            'original_path' => $name, 'name' => $name, 'type' => 'file',
            'size' => 1, 'storage_key' => 'key-'.$name, 'deleted_by' => $owner->id,
        ]);
        $item->forceFill(['created_at' => now()->subDays($ageDays)])->save();

        return $item;
    }

    public function test_purge_command_removes_items_older_than_retention(): void
    {
        $u = User::factory()->create();
        $old = $this->trashed($u, 'old.txt', 40);
        $recent = $this->trashed($u, 'recent.txt', 5);

        $this->artisan('trash:purge', ['--days' => 30])->assertSuccessful();

        $this->assertDatabaseMissing('trashed_items', ['id' => $old->id]);
        $this->assertDatabaseHas('trashed_items', ['id' => $recent->id]);
    }

    public function test_zero_retention_keeps_everything(): void
    {
        $u = User::factory()->create();
        $old = $this->trashed($u, 'old.txt', 400);

        $this->artisan('trash:purge', ['--days' => 0])->assertSuccessful();

        $this->assertDatabaseHas('trashed_items', ['id' => $old->id]);
    }

    public function test_command_reads_the_retention_setting(): void
    {
        Setting::put('trash_retention_days', 10);
        $u = User::factory()->create();
        $old = $this->trashed($u, 'old.txt', 15);

        $this->artisan('trash:purge')->assertSuccessful();

        $this->assertDatabaseMissing('trashed_items', ['id' => $old->id]);
    }
}
