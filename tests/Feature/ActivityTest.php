<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ActivityTest extends TestCase
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

    private function makeUser(string $role = 'user'): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function logFor(User $user, string $description): void
    {
        activity('filemanager')->causedBy($user)->event('test')->log($description);
    }

    public function test_activity_is_open_to_any_authenticated_user(): void
    {
        $this->actingAs($this->makeUser('user'))->get('/activity')->assertOk();
    }

    public function test_a_user_sees_only_their_own_activity(): void
    {
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->logFor($alice, 'alice uploaded a file');
        $this->logFor($bob, 'bob deleted a file');

        $this->actingAs($alice)->get('/activity')->assertInertia(fn (AssertableInertia $p) => $p
            ->component('activity/index')
            ->has('activities', 1)
            ->where('activities.0.description', 'alice uploaded a file')
            ->where('canViewAll', false)
        );
    }

    public function test_admin_defaults_to_their_own_activity(): void
    {
        $admin = $this->makeUser('admin');
        $user = $this->makeUser();
        $this->logFor($admin, 'admin action');
        $this->logFor($user, 'user action');

        $this->actingAs($admin)->get('/activity')->assertInertia(fn (AssertableInertia $p) => $p
            ->has('activities', 1)
            ->where('activities.0.description', 'admin action')
            ->where('canViewAll', true)
        );
    }

    public function test_admin_can_view_everyones_activity(): void
    {
        $admin = $this->makeUser('admin');
        $user = $this->makeUser();
        $this->logFor($admin, 'admin action');
        $this->logFor($user, 'user action');

        $this->actingAs($admin)->get('/activity?scope=all')->assertInertia(fn (AssertableInertia $p) => $p
            ->has('activities', 2)
            ->where('scope', 'all')
        );
    }

    public function test_non_admin_cannot_widen_scope_to_all(): void
    {
        $bob = $this->makeUser();
        $other = $this->makeUser();
        $this->logFor($bob, 'bob action');
        $this->logFor($other, 'other action');

        // Even asking for ?scope=all, a non-admin stays scoped to themselves.
        $this->actingAs($bob)->get('/activity?scope=all')->assertInertia(fn (AssertableInertia $p) => $p
            ->has('activities', 1)
            ->where('activities.0.description', 'bob action')
            ->where('scope', 'mine')
        );
    }
}
