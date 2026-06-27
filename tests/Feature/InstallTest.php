<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class InstallTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Simulate a fresh, not-yet-installed instance.
        Setting::forget('installed_at');
    }

    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'app_name' => 'My Files',
            'admin_name' => 'Boss',
            'admin_email' => 'boss@example.com',
            'password' => 'Sup3rSecret!',
            'password_confirmation' => 'Sup3rSecret!',
            'default_quota_gb' => 100,
        ], $overrides);
    }

    public function test_uninstalled_instance_redirects_everything_to_install(): void
    {
        $this->get('/')->assertRedirect('/install');
        $this->get('/dashboard')->assertRedirect('/install');
    }

    public function test_install_page_renders_with_system_checks(): void
    {
        $this->get('/install')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('install')
                ->has('checks')
                ->has('checks.0', fn (AssertableInertia $c) => $c
                    ->hasAll(['name', 'ok', 'value', 'critical'])
                )
            );
    }

    public function test_install_creates_admin_settings_and_logs_in(): void
    {
        $response = $this->post('/install', $this->validPayload());

        $response->assertRedirect('/dashboard');

        $admin = User::where('email', 'boss@example.com')->first();
        $this->assertNotNull($admin);
        $this->assertTrue($admin->hasRole('admin'));
        $this->assertAuthenticatedAs($admin);

        $this->assertSame('My Files', Setting::get('app_name'));
        $this->assertSame((int) round(100 * 1024 ** 3), (int) Setting::get('default_quota_bytes'));
        $this->assertTrue(Setting::installed());
    }

    public function test_default_quota_from_install_applies_to_new_users(): void
    {
        $this->post('/install', $this->validPayload(['default_quota_gb' => 250]));

        $this->assertSame((int) round(250 * 1024 ** 3), User::defaultQuotaBytes());
    }

    public function test_install_is_locked_once_completed(): void
    {
        $this->post('/install', $this->validPayload())->assertRedirect('/dashboard');

        // GET redirects away…
        $this->get('/install')->assertRedirect('/');

        // …and a second POST cannot create another admin.
        $this->post('/install', $this->validPayload([
            'admin_email' => 'intruder@example.com',
        ]))->assertForbidden();

        $this->assertNull(User::where('email', 'intruder@example.com')->first());
    }

    public function test_install_validates_input(): void
    {
        $this->post('/install', $this->validPayload([
            'admin_email' => 'not-an-email',
        ]))->assertSessionHasErrors('admin_email');

        $this->assertFalse(Setting::installed());
    }
}
