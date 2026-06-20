import { Head } from '@inertiajs/react';

import HeadingSmall from '@/components/heading-small';
import { ThemeAppearance } from '@/components/theme-appearance';
import { type BreadcrumbItem } from '@/types';

import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Appearance settings',
        href: '/settings/appearance',
    },
];

export default function Appearance() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Appearance settings" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall title="Appearance settings" description="Pick the interface theme and effects" />
                    <ThemeAppearance />
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
