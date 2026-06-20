<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Inertia\Inertia;
use Laravel\Fortify\Fortify;

/**
 * Only the 2FA feature is delegated to Fortify; login/registration/password
 * flows stay on the React starter kit's own controllers.
 */
class FortifyServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // The 2FA login challenge screen (after password, when 2FA is enabled).
        Fortify::twoFactorChallengeView(fn () => Inertia::render('auth/two-factor-challenge'));

        RateLimiter::for('two-factor', function (Request $request) {
            return Limit::perMinute(5)->by($request->session()->get('login.id'));
        });
    }
}
