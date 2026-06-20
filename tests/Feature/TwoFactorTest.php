<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TwoFactorTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_without_2fa_authenticates_normally(): void
    {
        $user = User::factory()->create();

        $this->post('/login', ['email' => $user->email, 'password' => 'password'])
            ->assertRedirect(route('dashboard', absolute: false));

        $this->assertAuthenticatedAs($user);
    }

    public function test_login_with_2fa_defers_to_the_challenge(): void
    {
        $user = User::factory()->create();
        $user->two_factor_secret = 'TESTSECRET';            // encrypted by the cast on save
        $user->two_factor_confirmed_at = now();
        $user->save();

        $this->post('/login', ['email' => $user->email, 'password' => 'password'])
            ->assertRedirect('/two-factor-challenge');

        // Not logged in yet — must pass the challenge first.
        $this->assertGuest();
        $this->assertEquals($user->id, session('login.id'));
    }

    public function test_two_factor_settings_page_loads(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/settings/two-factor')
            ->assertOk();
    }

    public function test_unconfirmed_2fa_does_not_gate_login(): void
    {
        // Secret set but never confirmed → login proceeds normally.
        $user = User::factory()->create();
        $user->two_factor_secret = 'TESTSECRET';
        $user->save();

        $this->post('/login', ['email' => $user->email, 'password' => 'password'])
            ->assertRedirect(route('dashboard', absolute: false));

        $this->assertAuthenticatedAs($user);
    }
}
