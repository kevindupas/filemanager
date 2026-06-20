<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Pulse dashboard (/pulse) is restricted to admins. Pulse checks this
        // gate via its Authorize middleware.
        Gate::define('viewPulse', fn (User $user) => $user->hasRole('admin'));
    }
}
