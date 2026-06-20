import { FileIcon } from '@/components/files/file-icon';
import { DataTable } from '@/components/thegridcn/data-table';
import { GridPanel } from '@/components/grid-panel';
import { Button } from '@/components/ui/button';
import { getXsrfToken } from '@/lib/csrf';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type FileEntry } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Star } from 'lucide-react';

interface FavoriteItem extends Record<string, unknown> {
    id: number;
    name: string;
    path: string;
    type: 'dir' | 'file';
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Favorites', href: '/favorites' }];

const asEntry = (f: FavoriteItem): FileEntry => ({
    name: f.name,
    path: f.path,
    type: f.type,
    size: null,
    modified: 0,
    extension: f.type === 'file' ? f.name.split('.').pop()?.toLowerCase() ?? null : null,
});

export default function Favorites({ favorites }: { favorites: FavoriteItem[] }) {
    const unstar = (path: string) =>
        fetch(route('favorites.toggle'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': getXsrfToken() },
            body: JSON.stringify({ path }),
        }).then(() => router.reload({ only: ['favorites'] }));

    const openHref = (f: FavoriteItem) => {
        if (f.type === 'dir') return route('files.index', { path: f.path });
        const parent = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '';
        return route('files.index', { path: parent });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Favorites" />

            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
                <h1 className="shrink-0 font-mono text-lg uppercase tracking-widest text-primary glow-text">Favorites</h1>

                {favorites.length === 0 ? (
                    <GridPanel label="FAVORITES">
                        <div className="px-4 py-16 text-center text-sm text-muted-foreground">
                            No favorites yet. Star a file or folder from the browser.
                        </div>
                    </GridPanel>
                ) : (
                    <DataTable
                        className="flex min-h-0 flex-1 flex-col"
                        label="FAVORITES"
                        data={favorites}
                        columns={[
                            {
                                key: 'path',
                                label: 'Item',
                                sortable: true,
                                render: (_v, f) => (
                                    <a href={openHref(f)} className="flex min-w-0 items-center gap-3 hover:text-primary">
                                        <FileIcon
                                            entry={asEntry(f)}
                                            className={`size-4 shrink-0 ${f.type === 'dir' ? 'text-primary glow-text' : 'text-muted-foreground'}`}
                                        />
                                        <span className="truncate">{f.path}</span>
                                    </a>
                                ),
                            },
                            { key: 'type', label: 'Type', sortable: true },
                            {
                                key: 'id',
                                label: '',
                                align: 'right',
                                render: (_v, f) => (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 text-primary"
                                        title="Remove from favorites"
                                        onClick={() => unstar(f.path)}
                                    >
                                        <Star className="size-4 fill-primary" />
                                    </Button>
                                ),
                            },
                        ]}
                    />
                )}
            </div>
        </AppLayout>
    );
}
