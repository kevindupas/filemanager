<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Create the minimal role/permission model for the file manager:
     * - permissions gate the sensitive/destructive actions
     * - browse + download stay open to any authenticated user (no permission needed)
     *
     * No accounts are seeded: the first admin is created by the install wizard
     * (/install), so no instance ships with hardcoded credentials.
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
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions($permissions);
        Role::firstOrCreate(['name' => 'user']);
    }
}
