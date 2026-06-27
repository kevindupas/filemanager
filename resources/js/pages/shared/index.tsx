import { GridPanel } from '@/components/grid-panel';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { formatBytes, formatDate } from '@/lib/format';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { ArrowLeft, Download, Eye, File, Folder, FolderOpen, User } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Grant {
    id: number;
    owner: string;
    path: string;
    name: string;
    permission: 'read' | 'write';
    is_dir: boolean;
}

interface Entry {
    name: string;
    path: string;
    type: 'dir' | 'file';
    size: number | null;
    modified: number;
    extension: string | null;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Shared with me', href: '/shared' }];

export default function SharedIndex({ grants }: { grants: Grant[] }) {
    const [active, setActive] = useState<Grant | null>(null);
    const [path, setPath] = useState('');
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!active || !active.is_dir) return;
        setLoading(true);
        fetch(`/shared/${active.id}/list?path=${encodeURIComponent(path)}`, { headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((d) => setEntries(d.entries ?? []))
            .finally(() => setLoading(false));
    }, [active, path]);

    const openFolder = (g: Grant) => {
        setActive(g);
        setPath(g.path);
    };

    const downloadUrl = (g: Grant, p: string) => `/shared/${g.id}/download?path=${encodeURIComponent(p)}`;
    const previewUrl = (g: Grant, p: string) => `/shared/${g.id}/preview?path=${encodeURIComponent(p)}`;

    // Path relative to the grant root, for the breadcrumb.
    const relPath = active ? path.slice(active.path.length).replace(/^\//, '') : '';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Shared with me" />

            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
                <h1 className="shrink-0 font-mono text-lg uppercase tracking-widest text-primary glow-text">Shared with me</h1>

                {!active ? (
                    grants.length === 0 ? (
                        <GridPanel label="SHARED">
                            <div className="px-4 py-16 text-center text-sm text-muted-foreground">Nothing shared with you yet.</div>
                        </GridPanel>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {grants.map((g) => (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => (g.is_dir ? openFolder(g) : setActive(g))}
                                    className="flex items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary/50"
                                >
                                    {g.is_dir ? <Folder className="size-8 shrink-0 text-primary" /> : <File className="size-8 shrink-0 text-muted-foreground" />}
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate font-medium">{g.name}</div>
                                        <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                            <User className="size-3" /> {g.owner}
                                        </div>
                                    </div>
                                    <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                                        {g.permission === 'write' ? 'edit' : 'view'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => setActive(null)}>
                                <ArrowLeft className="size-4" /> Back
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                <span className="text-foreground">{active.name}</span>
                                {relPath && ` / ${relPath}`}
                            </span>
                        </div>

                        {!active.is_dir ? (
                            <GridPanel label="FILE">
                                <div className="flex items-center gap-3 p-4">
                                    <File className="size-10 text-muted-foreground" />
                                    <span className="flex-1 font-medium">{active.name}</span>
                                    <a href={previewUrl(active, active.path)} target="_blank" rel="noreferrer">
                                        <Button variant="outline" size="sm" className="gap-2"><Eye className="size-4" /> Preview</Button>
                                    </a>
                                    <a href={downloadUrl(active, active.path)}>
                                        <Button size="sm" className="gap-2"><Download className="size-4" /> Download</Button>
                                    </a>
                                </div>
                            </GridPanel>
                        ) : (
                            <GridPanel label="SHARED FOLDER" className="flex min-h-0 flex-1 flex-col" bodyClassName="min-h-0 flex-1 overflow-auto">
                                {loading ? (
                                    <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>
                                ) : entries.length === 0 ? (
                                    <div className="px-4 py-10 text-center text-sm text-muted-foreground">Empty folder.</div>
                                ) : (
                                    <ul className="divide-y divide-border">
                                        {entries.map((e) => (
                                            <li key={e.path} className="flex items-center gap-3 px-4 py-2">
                                                {e.type === 'dir' ? (
                                                    <button type="button" className="flex flex-1 items-center gap-3 text-left" onClick={() => setPath(e.path)}>
                                                        <FolderOpen className="size-5 text-primary" />
                                                        <span className="flex-1 truncate">{e.name}</span>
                                                    </button>
                                                ) : (
                                                    <>
                                                        <File className="size-5 text-muted-foreground" />
                                                        <span className="flex-1 truncate">{e.name}</span>
                                                        <span className="hidden w-20 text-right text-xs text-muted-foreground sm:block">
                                                            {e.size != null ? formatBytes(e.size) : ''}
                                                        </span>
                                                        <span className="hidden w-32 text-right text-xs text-muted-foreground md:block">
                                                            {formatDate(e.modified)}
                                                        </span>
                                                        <a href={previewUrl(active, e.path)} target="_blank" rel="noreferrer">
                                                            <Button variant="ghost" size="icon" className="size-8"><Eye className="size-4" /></Button>
                                                        </a>
                                                        <a href={downloadUrl(active, e.path)}>
                                                            <Button variant="ghost" size="icon" className="size-8"><Download className="size-4" /></Button>
                                                        </a>
                                                    </>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </GridPanel>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
