import { FileIcon } from '@/components/files/file-icon';
import { DataCard } from '@/components/thegridcn/data-card';
import { DiagnosticsPanel } from '@/components/thegridcn/diagnostics-panel';
import { StatCard } from '@/components/thegridcn/stat-card';
import { GridPanel } from '@/components/grid-panel';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { formatBytes, formatDate } from '@/lib/format';
import { type BreadcrumbItem, type FileEntry } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { HardDrive } from 'lucide-react';

interface DashboardProps {
    stats: {
        files: number;
        folders: number;
        bytes: number;
        recent: FileEntry[];
    };
    userCount: number | null;
    quota: { used: number; limit: number; percent: number };
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];

export default function Dashboard({ stats, userCount, quota }: DashboardProps) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />

            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
                <div className="flex shrink-0 items-center justify-between">
                    <h1 className="font-mono text-lg uppercase tracking-widest text-primary glow-text">System status</h1>
                    <Button asChild className="glow-border gap-2">
                        <Link href={route('files.index')}>
                            <HardDrive className="size-4" />
                            Open file browser
                        </Link>
                    </Button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
                {/* Metric cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Files" value={stats.files} trend="neutral" />
                    <StatCard title="Folders" value={stats.folders} trend="neutral" />
                    <StatCard title="Storage" value={Math.round((stats.bytes / 1024 / 1024) * 10) / 10} unit="MB" trend="up" />
                    {userCount !== null && <StatCard title="Accounts" value={userCount} trend="neutral" />}
                </div>

                {/* Storage diagnostics + recent files */}
                <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
                    <div className="space-y-3">
                        <DiagnosticsPanel
                            title="STORAGE"
                            status={quota.percent >= 90 ? 'degraded' : 'online'}
                            metrics={[{ label: 'Disk usage', value: quota.percent }]}
                        />
                        <DataCard
                            title="QUOTA"
                            status={quota.percent >= 90 ? 'alert' : 'active'}
                            fields={[
                                { label: 'Used', value: formatBytes(quota.used), highlight: true },
                                { label: 'Limit', value: quota.limit > 0 ? formatBytes(quota.limit) : 'unlimited' },
                                { label: 'Free', value: quota.limit > 0 ? formatBytes(Math.max(0, quota.limit - quota.used)) : '—' },
                            ]}
                        />
                    </div>

                    <GridPanel label="RECENTLY MODIFIED">
                        <div className="min-w-[28rem]">
                            {stats.recent.length === 0 ? (
                                <div className="px-4 py-12 text-center text-sm text-muted-foreground">No files yet.</div>
                            ) : (
                                stats.recent.map((entry, i) => (
                                    <div
                                        key={entry.path}
                                        className={`grid grid-cols-[1fr_8rem_12rem] items-center gap-2 border-b border-primary/10 px-4 py-2.5 text-xs last:border-0 ${
                                            i % 2 === 1 ? 'bg-foreground/[0.02]' : ''
                                        }`}
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <FileIcon entry={entry} className="size-5 shrink-0 text-muted-foreground" />
                                            <span className="truncate">{entry.path}</span>
                                        </div>
                                        <span className="text-right text-muted-foreground">{formatBytes(entry.size)}</span>
                                        <span className="text-right text-muted-foreground">{formatDate(entry.modified)}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </GridPanel>
                </div>
                </div>
            </div>
        </AppLayout>
    );
}
