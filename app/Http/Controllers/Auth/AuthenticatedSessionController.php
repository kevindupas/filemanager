<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Show the login page.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('auth/login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        // Validate credentials WITHOUT logging in yet, so we can branch to the
        // 2FA challenge when the account has it enabled.
        $request->ensureIsNotRateLimited();

        $user = User::where('email', $request->string('email'))->first();

        if (! $user || ! Hash::check((string) $request->string('password'), $user->password)) {
            RateLimiter::hit($request->throttleKey());

            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        RateLimiter::clear($request->throttleKey());

        // Account has confirmed two-factor → defer to the Fortify challenge.
        if (! is_null($user->two_factor_secret) && ! is_null($user->two_factor_confirmed_at)) {
            $request->session()->put([
                'login.id' => $user->id,
                'login.remember' => $request->boolean('remember'),
            ]);

            return redirect()->route('two-factor.login');
        }

        Auth::login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
