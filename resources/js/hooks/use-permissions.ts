import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';

/**
 * Front-end mirror of the server-side gates. Used to hide unauthorized
 * actions — the backend still enforces every permission via middleware.
 */
export function usePermissions() {
    const { auth } = usePage<SharedData>().props;
    const permissions = auth?.permissions ?? [];
    const roles = auth?.roles ?? [];

    return {
        can: (permission: string) => permissions.includes(permission),
        hasRole: (role: string) => roles.includes(role),
        isAdmin: roles.includes('admin'),
    };
}
