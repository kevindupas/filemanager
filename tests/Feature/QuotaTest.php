<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\FileManager;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class QuotaTest extends TestCase
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

    private function makeUser(string $role = 'user', ?int $quotaBytes = null): User
    {
        $user = User::factory()->create(['quota_bytes' => $quotaBytes]);
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

    public function test_effective_quota_inherits_global_default_when_null(): void
    {
        config(['filemanager.quota_gb' => 10]);
        $user = $this->makeUser('user', null);

        $this->assertSame((int) round(10 * 1024 ** 3), $user->effectiveQuotaBytes());
    }

    public function test_effective_quota_uses_the_user_override(): void
    {
        config(['filemanager.quota_gb' => 10]);
        $user = $this->makeUser('user', 5000);

        $this->assertSame(5000, $user->effectiveQuotaBytes());
    }

    public function test_zero_override_means_unlimited(): void
    {
        config(['filemanager.quota_gb' => 1 / 1024 ** 3]); // tiny global default (1 byte)
        $user = $this->makeUser('user', 0);
        $this->userDisk($user)->put('big.bin', str_repeat('x', 5000));

        $this->actingAs($user);
        $this->assertFalse(app(FileManager::class)->exceedsQuota(PHP_INT_MAX - 1));
    }

    public function test_exceeds_quota_respects_user_override(): void
    {
        config(['filemanager.quota_gb' => 999]); // generous global default
        $user = $this->makeUser('user', 2500); // tight personal override
        $this->userDisk($user)->put('a.bin', str_repeat('x', 2000));

        $this->actingAs($user);
        $fm = app(FileManager::class);

        $this->assertFalse($fm->exceedsQuota(400)); // 2000 + 400 < 2500
        $this->assertTrue($fm->exceedsQuota(800));  // 2000 + 800 > 2500
    }

    public function test_quota_is_isolated_between_users(): void
    {
        config(['filemanager.quota_gb' => 999]);
        $tight = $this->makeUser('user', 2500);
        $roomy = $this->makeUser('user', 1_000_000);
        $this->userDisk($tight)->put('a.bin', str_repeat('x', 2000));
        $this->userDisk($roomy)->put('a.bin', str_repeat('x', 2000));

        $this->actingAs($tight);
        $this->assertTrue(app(FileManager::class)->exceedsQuota(800));

        $this->actingAs($roomy);
        $this->assertFalse(app(FileManager::class)->exceedsQuota(800));
    }

    public function test_admin_can_set_a_users_quota(): void
    {
        $admin = $this->makeUser('admin');
        $target = $this->makeUser('user', null);

        $this->actingAs($admin)
            ->put("/admin/users/{$target->id}", [
                'name' => $target->name,
                'email' => $target->email,
                'role' => 'user',
                'quota_gb' => 200,
            ])
            ->assertRedirect();

        $this->assertSame((int) round(200 * 1024 ** 3), $target->fresh()->quota_bytes);
    }

    public function test_admin_can_clear_quota_to_inherit_default(): void
    {
        $admin = $this->makeUser('admin');
        $target = $this->makeUser('user', 5000);

        $this->actingAs($admin)
            ->put("/admin/users/{$target->id}", [
                'name' => $target->name,
                'email' => $target->email,
                'role' => 'user',
                'quota_gb' => null,
            ])
            ->assertRedirect();

        $this->assertNull($target->fresh()->quota_bytes);
    }

    public function test_admin_can_set_unlimited_quota(): void
    {
        $admin = $this->makeUser('admin');
        $target = $this->makeUser('user', 5000);

        $this->actingAs($admin)
            ->put("/admin/users/{$target->id}", [
                'name' => $target->name,
                'email' => $target->email,
                'role' => 'user',
                'quota_gb' => 0,
            ])
            ->assertRedirect();

        $this->assertSame(0, $target->fresh()->quota_bytes);
    }

    public function test_non_admin_cannot_set_quota(): void
    {
        $user = $this->makeUser('user');
        $target = $this->makeUser('user');

        $this->actingAs($user)
            ->put("/admin/users/{$target->id}", [
                'name' => $target->name,
                'email' => $target->email,
                'role' => 'user',
                'quota_gb' => 200,
            ])
            ->assertForbidden();
    }

    public function test_dashboard_reports_the_effective_limit(): void
    {
        config(['filemanager.quota_gb' => 10]);
        $user = $this->makeUser('user', 5_000_000);

        $this->actingAs($user)
            ->get('/dashboard')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('quota.limit', 5_000_000)
            );
    }
}
