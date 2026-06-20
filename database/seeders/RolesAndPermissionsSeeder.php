<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Create the minimal role/permission model for the file manager:
     * - permissions gate the sensitive/destructive actions
     * - browse + download stay open to any authenticated user (no permission needed)
     */
    public function run(): void
    {
        // Reset cached roles and permissions before (re)seeding.
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = [
            'manage-users',
            'upload-files',
            'delete-files',
            'create-folders',
            'share-files',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // admin: everything. user: no special permission (browse/download only).
        $admin = Role::firstOrCreate(['name' => 'admin']);
        $admin->syncPermissions($permissions);

        Role::firstOrCreate(['name' => 'user']);

        // First admin account.
        $adminUser = User::firstOrCreate(
            ['email' => 'admin@filemanager.test'],
            ['name' => 'Admin', 'password' => Hash::make('password')],
        );
        $adminUser->assignRole('admin');

        // A plain user for testing the permission boundaries.
        $plainUser = User::firstOrCreate(
            ['email' => 'user@filemanager.test'],
            ['name' => 'User', 'password' => Hash::make('password')],
        );
        $plainUser->assignRole('user');
    }
}
