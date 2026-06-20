<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

/**
 * Account administration — restricted to the `manage-users` permission
 * (see route middleware). Each user carries exactly one role (admin|user).
 */
class UserController extends Controller
{
    public function index(): Response
    {
        $users = User::with('roles')->orderBy('name')->get()->map(fn (User $user) => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->roles->first()?->name,
            'created_at' => $user->created_at?->toDateString(),
        ]);

        return Inertia::render('admin/users', [
            'users' => $users,
            'roles' => Role::orderBy('name')->pluck('name'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', Password::defaults()],
            'role' => ['required', 'string', Rule::exists('roles', 'name')],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        $user->syncRoles([$data['role']]);
        Audit::log('user-created', "Created user {$user->email} ({$data['role']})");

        return back()->with('success', 'User created.');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', Password::defaults()],
            'role' => ['required', 'string', Rule::exists('roles', 'name')],
        ]);

        // Don't let the last admin demote themselves and lock everyone out.
        if ($user->id === $request->user()->id && $data['role'] !== 'admin' && $this->isLastAdmin($user)) {
            return back()->withErrors(['role' => 'You are the last admin — cannot demote yourself.']);
        }

        $user->update([
            'name' => $data['name'],
            'email' => $data['email'],
            ...($data['password'] ? ['password' => Hash::make($data['password'])] : []),
        ]);

        $user->syncRoles([$data['role']]);
        Audit::log('user-updated', "Updated user {$user->email} ({$data['role']})");

        return back()->with('success', 'User updated.');
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($user->id === $request->user()->id) {
            return back()->with('error', 'You cannot delete your own account.');
        }

        if ($this->isLastAdmin($user)) {
            return back()->with('error', 'Cannot delete the last admin.');
        }

        $email = $user->email;
        $user->delete();
        Audit::log('user-deleted', "Deleted user {$email}");

        return back()->with('success', 'User deleted.');
    }

    private function isLastAdmin(User $user): bool
    {
        return $user->hasRole('admin')
            && Role::findByName('admin')->users()->count() <= 1;
    }
}
