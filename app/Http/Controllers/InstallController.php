<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

/**
 * First-run install wizard. Reachable only until the instance is installed
 * (see EnsureInstalled middleware); creates the first admin account and base
 * settings, so nothing ships with hardcoded credentials.
 */
class InstallController extends Controller
{
    public function show(): Response|RedirectResponse
    {
        if (Setting::installed()) {
            return redirect('/');
        }

        return Inertia::render('install', [
            'checks' => $this->checks(),
            'defaultQuotaGb' => (float) config('filemanager.quota_gb'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_if(Setting::installed(), 403, 'Already installed.');

        $data = $request->validate([
            'app_name' => ['required', 'string', 'max:255'],
            'admin_name' => ['required', 'string', 'max:255'],
            'admin_email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'default_quota_gb' => ['nullable', 'numeric', 'min:0'],
        ]);

        // Roles/permissions must exist before assigning the admin role.
        (new RolesAndPermissionsSeeder)->run();

        $admin = User::create([
            'name' => $data['admin_name'],
            'email' => $data['admin_email'],
            'password' => Hash::make($data['password']),
        ]);
        $admin->assignRole('admin');

        Setting::put('app_name', $data['app_name']);
        if (($data['default_quota_gb'] ?? null) !== null && $data['default_quota_gb'] !== '') {
            Setting::put('default_quota_bytes', (int) round((float) $data['default_quota_gb'] * 1024 ** 3));
        }
        Setting::put('installed_at', now()->toIso8601String());

        Auth::login($admin);
        $request->session()->regenerate();

        return redirect('/dashboard');
    }

    /**
     * Pre-flight environment checks shown on the wizard.
     *
     * @return array<int, array{name: string, ok: bool, value: string, critical: bool}>
     */
    private function checks(): array
    {
        $dbOk = true;
        try {
            DB::connection()->getPdo();
        } catch (\Throwable) {
            $dbOk = false;
        }

        return [
            ['name' => 'PHP ≥ 8.4.1', 'ok' => version_compare(PHP_VERSION, '8.4.1', '>='), 'value' => PHP_VERSION, 'critical' => true],
            ['name' => 'Database connection', 'ok' => $dbOk, 'value' => (string) config('database.default'), 'critical' => true],
            ['name' => 'Migrations applied', 'ok' => $dbOk && Schema::hasTable('users'), 'value' => 'users table', 'critical' => true],
            ['name' => 'storage/ writable', 'ok' => is_writable(storage_path('app')), 'value' => storage_path('app'), 'critical' => true],
        ];
    }
}
