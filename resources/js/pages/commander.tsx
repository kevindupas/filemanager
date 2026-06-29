import { type Conflict, type ConflictAction, ConflictDialog } from '@/components/files/conflict-dialog';
import { FileIcon } from '@/components/files/file-icon';
import { GridPanel } from '@/components/grid-panel';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getXsrfToken } from '@/lib/csrf';
import { formatBytes } from '@/lib/format';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type FileEntry, type FileListing } from '@/types';
import { Head, router } from '@inertiajs/react';
import { ChevronRight, Copy, Download, FolderPlus, Home, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface DiskOption {
    key: string;
    label: string;
    type: string;
}
interface Can {
    delete: boolean;
    createFolders: boolean;
}
interface Pending {
    fromDisk: string;
    paths: string[];
    toDisk: string;
    toPath: string;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Commander', href: '/commander' }];

const diskParam = (disk: string) => (disk === 'local' ? {} : { disk });

export default function Commander({ disks, can }: { disks: DiskOption[]; can: Can }) {
    const secondDefault = disks.find((d) => d.key !== 'local')?.key ?? 'local';
    const [left, setLeft] = useState({ disk: 'local', path: '' });
    const [right, setRight] = useState({ disk: secondDefault, path: '' });
    const [nonce, setNonce] = useState(0);
    const [pending, setPending] = useState<Pending | null>(null);
    const [busy, setBusy] = useState(false);
    const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
    const [conflictMode, setConflictMode] = useState<'move' | 'copy'>('move');

    const reloadBoth = () => setNonce((n) => n + 1);

    // A background transfer finished → re-fetch both panes.
    useEffect(() => {
        const h = () => reloadBoth();
        window.addEventListener('fm-transfer-done', h);
        return () => window.removeEventListener('fm-transfer-done', h);
    }, []);

    // A drop landed on a pane → ask Move or Copy (unless it's a no-op).
    const onDrop = (payload: { disk: string; paths: string[] }, toDisk: string, toPath: string) => {
        if (!payload.paths.length) return;
        const parent = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
        if (toDisk === payload.disk) {
            // No-op: dropping onto the folder the items already live in.
            if (payload.paths.every((p) => parent(p) === toPath)) return;
            // Invalid: dropping a folder into itself or its own subtree.
            if (payload.paths.some((p) => toPath === p || toPath.startsWith(`${p}/`))) return;
        }
        setPending({ fromDisk: payload.disk, paths: payload.paths, toDisk, toPath });
    };

    // Step 1: ask the server which items collide; if any, open the conflict dialog.
    const runTransfer = async (mode: 'move' | 'copy') => {
        if (!pending) return;
        setBusy(true);
        try {
            const res = await fetch(route('files.transfer.check'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': getXsrfToken() },
                body: JSON.stringify({ paths: pending.paths, destination: pending.toPath, destDisk: pending.toDisk, ...diskParam(pending.fromDisk) }),
            });
            const data = await res.json();
            if (data.conflicts?.length) {
                setConflictMode(mode);
                setConflicts(data.conflicts);
                setBusy(false);
                return;
            }
        } catch {
            /* check failed → fall through and let the server handle it */
        }
        doTransfer(mode, {});
    };

    // Step 2: actually move/copy, with any chosen conflict resolutions.
    const doTransfer = (mode: 'move' | 'copy', resolutions: Record<string, ConflictAction>) => {
        if (!pending) return;
        setBusy(true);
        router.post(
            route(mode === 'move' ? 'files.move' : 'files.copy'),
            {
                paths: pending.paths,
                destination: pending.toPath,
                destDisk: pending.toDisk,
                resolutions,
                ...diskParam(pending.fromDisk),
            },
            {
                preserveState: true,
                preserveScroll: true,
                onFinish: () => {
                    setBusy(false);
                    // Same-disk transfers are synchronous (done now) → refresh immediately.
                    // Cross-disk transfers run in the background → wait for 'fm-transfer-done'.
                    const sameDisk = pending && pending.fromDisk === pending.toDisk;
                    setPending(null);
                    setConflicts(null);
                    if (sameDisk) reloadBoth();
                    window.dispatchEvent(new Event('fm-transfer')); // wake the transfers tray
                },
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Commander" />
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                <div className="flex shrink-0 items-center justify-between">
                    <h1 className="font-mono text-lg uppercase tracking-widest text-primary glow-text">Commander</h1>
                    <Button variant="outline" size="sm" className="gap-2" onClick={reloadBoth}>
                        <RefreshCw className="size-4" /> Refresh
                    </Button>
                </div>

                <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
                    <CommanderPane state={left} setState={setLeft} disks={disks} can={can} nonce={nonce} onDrop={onDrop} onChanged={reloadBoth} />
                    <CommanderPane state={right} setState={setRight} disks={disks} can={can} nonce={nonce} onDrop={onDrop} onChanged={reloadBoth} />
                </div>
            </div>

            <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-mono uppercase tracking-widest">Transfer</DialogTitle>
                        <DialogDescription>
                            {pending?.paths.length} item(s) → <span className="text-primary">{pending?.toDisk}:/{pending?.toPath}</span>
                        </DialogDescription>
                    </DialogHeader>
                    {busy && (
                        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin text-primary" /> Transferring… (large files may take a while)
                        </p>
                    )}
                    <DialogFooter>
                        <Button variant="outline" disabled={busy} onClick={() => setPending(null)}>
                            Cancel
                        </Button>
                        <Button variant="outline" className="gap-2" disabled={busy} onClick={() => runTransfer('copy')}>
                            {busy ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />} Copy
                        </Button>
                        <Button className="glow-border gap-2" disabled={busy} onClick={() => runTransfer('move')}>
                            {busy && <Loader2 className="size-4 animate-spin" />} Move
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {conflicts && (
                <ConflictDialog
                    conflicts={conflicts}
                    busy={busy}
                    onCancel={() => setConflicts(null)}
                    onResolve={(resolutions) => {
                        setConflicts(null);
                        doTransfer(conflictMode, resolutions);
                    }}
                />
            )}
        </AppLayout>
    );
}

function CommanderPane({
    state,
    setState,
    disks,
    can,
    nonce,
    onDrop,
    onChanged,
}: {
    state: { disk: string; path: string };
    setState: (s: { disk: string; path: string }) => void;
    disks: DiskOption[];
    can: Can;
    nonce: number;
    onDrop: (payload: { disk: string; paths: string[] }, toDisk: string, toPath: string) => void;
    onChanged: () => void;
}) {
    const { disk, path } = state;
    const [listing, setListing] = useState<FileListing | null>(null);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [dragOver, setDragOver] = useState(false);
    const [dragOverDir, setDragOverDir] = useState<string | null>(null);
    const [newFolder, setNewFolder] = useState('');
    const [showNew, setShowNew] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        setSelected(new Set());
        fetch(route('files.list', { path, ...diskParam(disk) }), { headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then(setListing)
            .catch(() => setListing(null))
            .finally(() => setLoading(false));
    }, [disk, path]);

    useEffect(() => {
        load();
    }, [load, nonce]);

    const entries = listing?.entries ?? [];
    const toggle = (p: string) =>
        setSelected((prev) => {
            const n = new Set(prev);
            if (n.has(p)) n.delete(p);
            else n.add(p);
            return n;
        });

    const dragPayload = (entry: FileEntry) =>
        JSON.stringify({ disk, paths: selected.has(entry.path) && selected.size ? [...selected] : [entry.path] });

    const handleDrop = (e: React.DragEvent, destPath: string) => {
        e.preventDefault();
        setDragOver(false);
        setDragOverDir(null);
        const raw = e.dataTransfer.getData('text/fm');
        if (!raw) return;
        const payload = JSON.parse(raw) as { disk: string; paths: string[] };
        onDrop(payload, disk, destPath);
    };

    const headers = () => ({ 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': getXsrfToken() });

    const createFolder = () => {
        fetch(route('files.folders.store'), {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ name: newFolder, path, ...diskParam(disk) }),
        }).then(() => {
            setNewFolder('');
            setShowNew(false);
            load();
        });
    };

    const deleteSelected = () => {
        if (!selected.size) return;
        fetch(route('files.destroy'), {
            method: 'DELETE',
            headers: headers(),
            body: JSON.stringify({ paths: [...selected], ...diskParam(disk) }),
        }).then(() => {
            onChanged();
        });
    };

    return (
        <GridPanel
            label={disks.find((d) => d.key === disk)?.label ?? disk}
            className="flex min-h-0 flex-col"
            bodyClassName="flex min-h-0 flex-1 flex-col"
        >
            <div className="flex min-h-0 flex-1 flex-col">
                {/* Pane toolbar */}
                <div className="flex items-center gap-2 border-b border-primary/15 px-2 py-1.5">
                    <Select value={disk} onValueChange={(v) => setState({ disk: v, path: '' })}>
                        <SelectTrigger className="h-8 w-36">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {disks.map((d) => (
                                <SelectItem key={d.key} value={d.key}>
                                    {d.label}
                                    {d.type !== 'local' ? ` (${d.type})` : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="ml-auto flex items-center gap-1">
                        {can.createFolders && (
                            <Button variant="ghost" size="icon" className="size-8" title="New folder" onClick={() => setShowNew((s) => !s)}>
                                <FolderPlus className="size-4" />
                            </Button>
                        )}
                        {can.delete && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive disabled:opacity-40"
                                title="Delete selected"
                                disabled={!selected.size}
                                onClick={deleteSelected}
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="size-8" title="Refresh" onClick={load}>
                            <RefreshCw className="size-4" />
                        </Button>
                    </div>
                </div>

                {/* Breadcrumb */}
                <nav className="flex flex-wrap items-center gap-1 border-b border-primary/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider">
                    {(listing?.breadcrumbs ?? [{ name: 'Home', path: '' }]).map((c, i) => (
                        <span key={c.path} className="flex items-center gap-1">
                            {i > 0 && <ChevronRight className="size-3 text-foreground/20" />}
                            <button
                                type="button"
                                onClick={() => setState({ disk, path: c.path })}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDragOverDir(`crumb:${c.path}`);
                                }}
                                onDragLeave={() => setDragOverDir(null)}
                                onDrop={(e) => {
                                    e.stopPropagation();
                                    handleDrop(e, c.path);
                                }}
                                className={`rounded px-1 text-foreground/60 hover:text-primary ${
                                    dragOverDir === `crumb:${c.path}` ? 'bg-primary/25 text-primary ring-2 ring-inset ring-primary' : ''
                                }`}
                            >
                                {i === 0 ? <Home className="size-3.5" /> : c.name}
                            </button>
                        </span>
                    ))}
                </nav>

                {showNew && (
                    <div className="flex items-center gap-2 border-b border-primary/10 px-3 py-2">
                        <Label className="sr-only">Folder name</Label>
                        <Input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="New folder name" className="h-8" />
                        <Button size="sm" onClick={createFolder} disabled={!newFolder}>
                            Create
                        </Button>
                    </div>
                )}

                {/* Always-visible drop strip → drops into the CURRENT folder, even when
                    the list is full of folders (which would otherwise steal every drop). */}
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverDir(null);
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                        e.stopPropagation();
                        handleDrop(e, path);
                    }}
                    className={`flex items-center gap-2 border-b border-dashed px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                        dragOver && !dragOverDir
                            ? 'border-primary bg-primary/20 text-primary'
                            : 'border-primary/25 text-foreground/45'
                    }`}
                >
                    <Download className="size-3" /> Drop here → /{path || 'home'}
                </div>

                {/* File list — empty space also drops into the current folder. */}
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                        setDragOverDir(null);
                    }}
                    onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
                    }}
                    onDrop={(e) => handleDrop(e, path)}
                    className={`relative min-h-0 flex-1 overflow-y-auto transition-colors ${dragOver && !dragOverDir ? 'bg-primary/5' : ''}`}
                >
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="size-5 animate-spin text-primary" />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="px-4 py-12 text-center text-xs text-muted-foreground">Empty folder. Drop files here.</div>
                    ) : (
                        entries.map((entry) => {
                            const isDir = entry.type === 'dir';
                            return (
                                <div
                                    key={entry.path}
                                    draggable
                                    onDragStart={(e) => e.dataTransfer.setData('text/fm', dragPayload(entry))}
                                    onDragOver={
                                        isDir
                                            ? (e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  setDragOverDir(entry.path);
                                              }
                                            : undefined
                                    }
                                    onDragLeave={isDir ? () => setDragOverDir(null) : undefined}
                                    onDrop={
                                        isDir
                                            ? (e) => {
                                                  e.stopPropagation();
                                                  handleDrop(e, entry.path);
                                              }
                                            : undefined
                                    }
                                    className={`grid grid-cols-[2rem_1fr_6rem] items-center gap-2 border-b border-primary/10 px-3 py-2 text-xs last:border-0 hover:bg-primary/5 ${
                                        dragOverDir === entry.path ? 'bg-primary/25 ring-2 ring-inset ring-primary' : selected.has(entry.path) ? 'bg-primary/10' : ''
                                    }`}
                                >
                                    <Checkbox checked={selected.has(entry.path)} onCheckedChange={() => toggle(entry.path)} />
                                    <button
                                        type="button"
                                        onClick={() => isDir && setState({ disk, path: entry.path })}
                                        className="flex min-w-0 items-center gap-2 text-left"
                                    >
                                        <FileIcon entry={entry} className={`size-4 shrink-0 ${isDir ? 'text-primary glow-text' : 'text-muted-foreground'}`} />
                                        <span className="truncate">{entry.name}</span>
                                    </button>
                                    <span className="text-right text-muted-foreground">{formatBytes(entry.size)}</span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </GridPanel>
    );
}
