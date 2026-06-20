import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { Toaster, toast } from 'sonner';

/**
 * Mounts the sonner toaster and turns Inertia session flash (success/error)
 * into toasts. Mount once in the authenticated layout.
 */
export function FlashToaster() {
    const { flash } = usePage<SharedData>().props;

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
    }, [flash?.success]);

    useEffect(() => {
        if (flash?.error) toast.error(flash.error);
    }, [flash?.error]);

    // Top-right so toasts don't overlap the transfers tray (bottom-right).
    return <Toaster theme="dark" position="top-right" richColors closeButton />;
}
