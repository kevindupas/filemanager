<?php

use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\TokenController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware('auth')->group(function () {
    Route::redirect('settings', 'settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/password', [PasswordController::class, 'edit'])->name('password.edit');
    Route::put('settings/password', [PasswordController::class, 'update'])->name('password.update');

    Route::get('settings/appearance', function () {
        return Inertia::render('settings/appearance');
    })->name('appearance');

    Route::get('settings/tokens', [TokenController::class, 'edit'])->name('tokens.edit');
    Route::post('settings/tokens', [TokenController::class, 'store'])->name('tokens.store');
    Route::delete('settings/tokens/{token}', [TokenController::class, 'destroy'])->name('tokens.destroy');

    Route::get('settings/two-factor', function (Request $request) {
        $user = $request->user();

        return Inertia::render('settings/two-factor', [
            'enabled' => ! is_null($user->two_factor_secret),
            'confirmed' => ! is_null($user->two_factor_confirmed_at),
        ]);
    })->name('two-factor.edit');
});
