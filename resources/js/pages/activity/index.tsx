import { DataTable } from '@/components/thegridcn/data-table';
import { GridPanel } from '@/components/grid-panel';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

interface ActivityEntry extends Record<string, unknown> {
    id: number;
    event: string | null;
    description: string;
    causer: string;
    created_at: string | null;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Activity', href: '/activity' }];

const EVENT_TONE: Record<string, string> = {
    uploaded: 'text-primary',
    'created-folder': 'text-primary',
    shared: 'text-primary',
    restored: 'text-primary',
    trashed: 'text-destructive',
    purged: 'text-destructive',
    'emptied-trash': 'text-destructive',
};

export default function ActivityPage({ activities }: { activities: ActivityEntry[] }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Activity" />

            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
                <h1 className="shrink-0 font-mono text-lg uppercase tracking-widest text-primary glow-text">Audit log</h1>

                {activities.length === 0 ? (
                    <GridPanel label="AUDIT LOG">
                        <div className="px-4 py-16 text-center text-sm text-muted-foreground">No activity yet.</div>
                    </GridPanel>
                ) : (
                    <DataTable
                        className="flex min-h-0 flex-1 flex-col"
                        label="AUDIT LOG"
                        data={activities}
                        columns={[
                            { key: 'created_at', label: 'When', sortable: true },
                            { key: 'causer', label: 'Who', sortable: true },
                            {
                                key: 'event',
                                label: 'Event',
                                render: (v) => (
                                    <Badge variant="secondary" className={`font-mono text-[10px] uppercase ${EVENT_TONE[String(v)] ?? ''}`}>
                                        {String(v ?? '—')}
                                    </Badge>
                                ),
                            },
                            { key: 'description', label: 'Detail' },
                        ]}
                    />
                )}
            </div>
        </AppLayout>
    );
}
