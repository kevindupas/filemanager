import { type Conflict, type ConflictAction, ConflictDialog } from '@/components/files/conflict-dialog';
import { FileIcon } from '@/components/files/file-icon';
import { FileInfoDialog } from '@/components/files/file-info-dialog';
import { FileViewer } from '@/components/files/file-viewer';
import { FolderPicker } from '@/components/files/folder-picker';
import { ShareDialog } from '@/components/files/share-dialog';
import { UploadDialog } from '@/components/files/upload-dialog';
import { GridPanel } from '@/components/grid-panel';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu as DM,
    DropdownMenuContent as DMC,
    DropdownMenuItem as DMI,
    DropdownMenuTrigger as DMT,
} from '@/components/ui/dropdown-menu';
import { DiskProvider, useActiveDisk } from '@/hooks/use-active-disk';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getXsrfToken } from '@/lib/csrf';
import AppLayout from '@/layouts/app-layout';
import { formatBytes, formatDate } from '@/lib/format';
import { type BreadcrumbItem, type FileEntry, type FileListing, type FilePermissions } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    Check,
    ChevronRight,
    Copy,
    Download,
    Eye,
    FileArchive,
    FolderInput,
    FolderPlus,
    HardDrive,
    Home,
    Info,
    LayoutGrid,
    List,
    MoreVertical,
    Pencil,
    Search,
    Share2,
    Star,
    Trash2,
    UploadCloud,
    X,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

interface SearchResult {
    path: string;
    query: string;
    truncated: boolean;
    entries: FileEntry[];
}

interface DiskOption {
    key: string;
    label: string;
    type: string;
}

interface BrowserProps {
    listing: FileListing;
    search: SearchResult | null;
    favorites: string[];
    disk: string;
    disks: DiskOption[];
    can: FilePermissions;
}

type SortKey = 'name' | 'size' | 'modified';
type TransferMode = 'move' | 'copy';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Files', href: '/files' }];

export default function Browser({ listing, search, favorites, disk, disks, can }: BrowserProps) {
    const searchMode = !!search;
    const favSet = new Set(favorites);
    // Spread into route()/payloads so every action targets the active disk.
    const dq: Record<string, string> = disk === 'local' ? {} : { disk };

    const toggleFavorite = (path: string) => {
        fetch(route('favorites.toggle'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': getXsrfToken() },
            body: JSON.stringify({ path }),
        }).then(() => router.reload({ only: ['favorites'] }));
    };

    // A background transfer finished → refresh the listing so the moved/copied file shows.
    useEffect(() => {
        const h = () => router.reload({ only: ['listing', 'search', 'favorites'] });
        window.addEventListener('fm-transfer-done', h);
        return () => window.removeEventListener('fm-transfer-done', h);
    }, []);

    const [newFolderOpen, setNewFolderOpen] = useState(false);
    const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
    const [deleteTargets, setDeleteTargets] = useState<FileEntry[] | null>(null);
    const [viewTarget, setViewTarget] = useState<FileEntry | null>(null);
    const [infoTarget, setInfoTarget] = useState<FileEntry | null>(null);
    const [shareTarget, setShareTarget] = useState<FileEntry | null>(null);
    const [transfer, setTransfer] = useState<{ mode: TransferMode; paths: string[] } | null>(null);
    const [transferBusy, setTransferBusy] = useState(false);
    const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
    const [conflictPending, setConflictPending] = useState<{ paths: string[]; destDisk: string; destination: string; mode: TransferMode } | null>(null);

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [lastIndex, setLastIndex] = useState<number | null>(null);
    const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
    const [dragOver, setDragOver] = useState<string | null>(null);
    const dragPaths = useRef<string[]>([]);

    const [view, setView] = useState<'list' | 'grid'>('list');
    const searchRef = useRef<HTMLInputElement>(null);

    // Drop-to-upload-anywhere overlay state.
    const [uploadOpen, setUploadOpen] = useState(false);
    const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
    const [fileDragDepth, setFileDragDepth] = useState(0);

    useEffect(() => {
        const saved = localStorage.getItem('fm-view');
        if (saved === 'grid' || saved === 'list') setView(saved);
    }, []);

    const changeView = (v: 'list' | 'grid') => {
        setView(v);
        localStorage.setItem('fm-view', v);
    };

    // Search input (debounced server visit).
    const [query, setQuery] = useState(search?.query ?? '');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setSelected(new Set());
        setLastIndex(null);
    }, [listing.path, searchMode]);

    const runSearch = (value: string) => {
        setQuery(value);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            router.get(
                route('files.index', value.trim() ? { path: listing.path, search: value.trim(), ...dq } : { path: listing.path, ...dq }),
                {},
                { preserveState: true, preserveScroll: true, replace: true, only: ['search'] },
            );
        }, 300);
    };

    const sourceEntries = searchMode ? search!.entries : listing.entries;

    const entries = useMemo(() => {
        const dir = sort.dir === 'asc' ? 1 : -1;
        return [...sourceEntries].sort((a, b) => {
            // Folders always first.
            if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
            if (sort.key === 'name') return dir * a.name.localeCompare(b.name, undefined, { numeric: true });
            if (sort.key === 'size') return dir * ((a.size ?? 0) - (b.size ?? 0));
            return dir * (a.modified - b.modified);
        });
    }, [sourceEntries, sort]);

    const toggleSort = (key: SortKey) =>
        setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

    // --- selection ---
    const toggle = (path: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(path) ? next.delete(path) : next.add(path);
            return next;
        });

    const handleActivate = (entry: FileEntry, index: number, e: React.MouseEvent) => {
        if (e.metaKey || e.ctrlKey) {
            toggle(entry.path);
            setLastIndex(index);
            return;
        }
        if (e.shiftKey && lastIndex !== null) {
            const [from, to] = [Math.min(lastIndex, index), Math.max(lastIndex, index)];
            setSelected((prev) => {
                const next = new Set(prev);
                for (let i = from; i <= to; i++) next.add(entries[i].path);
                return next;
            });
            return;
        }
        setLastIndex(index);
        if (entry.type === 'dir') {
            router.get(route('files.index', { path: entry.path, ...dq }));
        } else {
            setViewTarget(entry);
        }
    };

    const allSelected = entries.length > 0 && entries.every((e) => selected.has(e.path));
    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.path)));

    // --- bulk actions ---
    const selectedPaths = [...selected];

    const bulkDownload = () => {
        entries
            .filter((e) => selected.has(e.path) && e.type === 'file')
            .forEach((e, i) => {
                setTimeout(() => {
                    const a = document.createElement('a');
                    a.href = route('files.download', { path: e.path, ...dq });
                    a.download = e.name;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                }, i * 300);
            });
    };

    const moveTo = async (paths: string[], destDisk: string, destination: string, mode: TransferMode) => {
        setTransferBusy(true);
        try {
            const res = await fetch(route('files.transfer.check'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': getXsrfToken() },
                body: JSON.stringify({ paths, destination, destDisk, ...dq }),
            });
            const data = await res.json();
            if (data.conflicts?.length) {
                setConflictPending({ paths, destDisk, destination, mode });
                setConflicts(data.conflicts);
                setTransferBusy(false);
                return;
            }
        } catch {
            /* check failed → let the server handle it */
        }
        doMove(paths, destDisk, destination, mode, {});
    };

    const doMove = (
        paths: string[],
        destDisk: string,
        destination: string,
        mode: TransferMode,
        resolutions: Record<string, ConflictAction>,
    ) => {
        setTransferBusy(true);
        router.post(
            route(mode === 'move' ? 'files.move' : 'files.copy'),
            { paths, destination, destDisk, resolutions, ...dq },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSelected(new Set());
                    window.dispatchEvent(new Event('fm-transfer')); // wake the transfers tray (cross-disk jobs)
                },
                onFinish: () => {
                    setTransferBusy(false);
                    setTransfer(null);
                    setConflicts(null);
                    setConflictPending(null);
                },
            },
        );
    };

    // --- drag & drop ---
    const onDragStart = (entry: FileEntry) => {
        dragPaths.current = selected.has(entry.path) && selected.size > 0 ? [...selected] : [entry.path];
    };
    const onDropInto = (folderPath: string) => {
        setDragOver(null);
        const paths = dragPaths.current.filter((p) => p !== folderPath);
        if (paths.length) moveTo(paths, disk, folderPath, 'move');
        dragPaths.current = [];
    };

    const downloadZip = (paths: string[]) => {
        window.location.href = route('files.zip', { paths, ...dq });
    };

    // --- keyboard shortcuts ---
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement | null;
            const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable;

            if (e.key === '/' && !typing) {
                e.preventDefault();
                searchRef.current?.focus();
                return;
            }
            if (typing) return;

            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                setSelected(new Set(entries.map((en) => en.path)));
            } else if (e.key === 'Escape') {
                setSelected(new Set());
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size > 0 && can.delete) {
                e.preventDefault();
                setDeleteTargets(entries.filter((en) => selected.has(en.path)));
            } else if (e.key === 'F2' && selected.size === 1) {
                const en = entries.find((x) => x.path === [...selected][0]);
                if (en) setRenameTarget(en);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [entries, selected, can.delete]);

    // --- drop files anywhere on the page to upload ---
    useEffect(() => {
        if (!can.upload || searchMode) return;
        const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
        const enter = (e: DragEvent) => hasFiles(e) && (e.preventDefault(), setFileDragDepth((d) => d + 1));
        const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
        const leave = (e: DragEvent) => hasFiles(e) && setFileDragDepth((d) => Math.max(0, d - 1));
        const drop = (e: DragEvent) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            setFileDragDepth(0);
            const files = Array.from(e.dataTransfer?.files ?? []);
            if (files.length) {
                setDroppedFiles(files);
                setUploadOpen(true);
            }
        };
        window.addEventListener('dragenter', enter);
        window.addEventListener('dragover', over);
        window.addEventListener('dragleave', leave);
        window.addEventListener('drop', drop);
        return () => {
            window.removeEventListener('dragenter', enter);
            window.removeEventListener('dragover', over);
            window.removeEventListener('dragleave', leave);
            window.removeEventListener('drop', drop);
        };
    }, [can.upload, searchMode, listing.path]);

    return (
        <DiskProvider disk={disk}>
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Files" />

            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
                {/* Toolbar */}
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <DiskSwitcher disk={disk} disks={disks} />
                        {searchMode ? (
                            <span className="font-mono text-sm text-muted-foreground">
                                Results for <span className="text-primary glow-text">“{search!.query}”</span>
                                {search!.truncated && ' (first 500)'}
                            </span>
                        ) : (
                            <PathBreadcrumbs
                                crumbs={listing.breadcrumbs}
                                dragOver={dragOver}
                                setDragOver={setDragOver}
                                onDropInto={onDropInto}
                            />
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex rounded-md border border-border">
                            <button
                                type="button"
                                onClick={() => changeView('list')}
                                className={`rounded-l-md px-2 py-2 ${view === 'list' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                title="List view"
                            >
                                <List className="size-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => changeView('grid')}
                                className={`rounded-r-md px-2 py-2 ${view === 'grid' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                title="Grid view"
                            >
                                <LayoutGrid className="size-4" />
                            </button>
                        </div>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                ref={searchRef}
                                value={query}
                                onChange={(e) => runSearch(e.target.value)}
                                placeholder="Search…"
                                className="w-44 pl-8 pr-8"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => runSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </div>
                        {can.createFolders && !searchMode && (
                            <Button variant="outline" className="gap-2" onClick={() => setNewFolderOpen(true)}>
                                <FolderPlus className="size-4" />
                                New folder
                            </Button>
                        )}
                        {can.upload && !searchMode && <UploadDialog path={listing.path} />}
                    </div>
                </div>

                {/* Bulk action bar */}
                {selected.size > 0 && (
                    <div className="glow-border flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2">
                        <span className="font-mono text-sm text-primary">{selected.size} selected</span>
                        <div className="ml-auto flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTransfer({ mode: 'move', paths: selectedPaths })}>
                                <FolderInput className="size-4" /> Move
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTransfer({ mode: 'copy', paths: selectedPaths })}>
                                <Copy className="size-4" /> Copy
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1.5" onClick={bulkDownload}>
                                <Download className="size-4" /> Download
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => downloadZip(selectedPaths)}>
                                <FileArchive className="size-4" /> Zip
                            </Button>
                            {can.delete && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 text-destructive hover:text-destructive"
                                    onClick={() => setDeleteTargets(entries.filter((e) => selected.has(e.path)))}
                                >
                                    <Trash2 className="size-4" /> Delete
                                </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                                Clear
                            </Button>
                        </div>
                    </div>
                )}

                {/* Listing */}
                {entries.length === 0 ? (
                    <GridPanel label={searchMode ? 'SEARCH RESULTS' : 'FILES'}>
                        <div className="px-4 py-16 text-center text-sm text-muted-foreground">
                            {searchMode ? 'No matches.' : 'This folder is empty.'}
                        </div>
                    </GridPanel>
                ) : view === 'list' ? (
                    <GridPanel
                        label={searchMode ? 'SEARCH RESULTS' : 'FILES'}
                        className="flex min-h-0 flex-1 flex-col"
                        bodyClassName="min-h-0 flex-1 overflow-auto"
                    >
                        <div className="min-w-[40rem]">
                            <div className="sticky top-0 z-10 grid grid-cols-[2.5rem_1fr_8rem_12rem_3rem] items-center gap-2 border-b border-primary/20 bg-card/95 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-foreground/40 backdrop-blur-sm">
                                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                                <SortHeader label="Name" active={sort.key === 'name'} dir={sort.dir} onClick={() => toggleSort('name')} />
                                <SortHeader label="Size" align="right" active={sort.key === 'size'} dir={sort.dir} onClick={() => toggleSort('size')} />
                                <SortHeader label="Modified" align="right" active={sort.key === 'modified'} dir={sort.dir} onClick={() => toggleSort('modified')} />
                                <span></span>
                            </div>

                            {entries.map((entry, index) => (
                                <FileRow
                                    key={entry.path}
                                    entry={entry}
                                    index={index}
                                    can={can}
                                    searchMode={searchMode}
                                    selected={selected.has(entry.path)}
                                    dragOver={dragOver === entry.path}
                                    onActivate={handleActivate}
                                    onToggle={() => toggle(entry.path)}
                                    onView={() => setViewTarget(entry)}
                                    onInfo={() => setInfoTarget(entry)}
                                    onShare={() => setShareTarget(entry)}
                                    onRename={() => setRenameTarget(entry)}
                                    onDelete={() => setDeleteTargets([entry])}
                                    onMove={() => setTransfer({ mode: 'move', paths: [entry.path] })}
                                    onCopy={() => setTransfer({ mode: 'copy', paths: [entry.path] })}
                                    onZip={() => downloadZip([entry.path])}
                                    isFav={favSet.has(entry.path)}
                                    onFavorite={() => toggleFavorite(entry.path)}
                                    onDragStart={() => onDragStart(entry)}
                                    setDragOver={setDragOver}
                                    onDropInto={onDropInto}
                                />
                            ))}
                        </div>
                    </GridPanel>
                ) : (
                    <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        {entries.map((entry, index) => (
                            <GridCard
                                key={entry.path}
                                entry={entry}
                                index={index}
                                can={can}
                                searchMode={searchMode}
                                selected={selected.has(entry.path)}
                                dragOver={dragOver === entry.path}
                                onActivate={handleActivate}
                                onToggle={() => toggle(entry.path)}
                                onView={() => setViewTarget(entry)}
                                onInfo={() => setInfoTarget(entry)}
                                onShare={() => setShareTarget(entry)}
                                onRename={() => setRenameTarget(entry)}
                                onDelete={() => setDeleteTargets([entry])}
                                onMove={() => setTransfer({ mode: 'move', paths: [entry.path] })}
                                onCopy={() => setTransfer({ mode: 'copy', paths: [entry.path] })}
                                onZip={() => downloadZip([entry.path])}
                                isFav={favSet.has(entry.path)}
                                onFavorite={() => toggleFavorite(entry.path)}
                                onDragStart={() => onDragStart(entry)}
                                setDragOver={setDragOver}
                                onDropInto={onDropInto}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Drop-to-upload overlay */}
            {fileDragDepth > 0 && (
                <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                    <div className="glow-border flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary px-12 py-10">
                        <UploadCloud className="size-12 text-primary glow-text" />
                        <p className="font-mono uppercase tracking-widest text-primary">Drop to upload</p>
                    </div>
                </div>
            )}

            <NewFolderDialog open={newFolderOpen} onOpenChange={setNewFolderOpen} path={listing.path} />
            <RenameDialog target={renameTarget} onClose={() => setRenameTarget(null)} />
            <DeleteDialog targets={deleteTargets} onClose={() => setDeleteTargets(null)} onDone={() => setSelected(new Set())} />
            <FileViewer target={viewTarget} onClose={() => setViewTarget(null)} canEdit={can.upload} gallery={sourceEntries} />
            <FileInfoDialog target={infoTarget} onClose={() => setInfoTarget(null)} />
            <ShareDialog target={shareTarget} onClose={() => setShareTarget(null)} />
            <FolderPicker
                open={!!transfer}
                title={transfer?.mode === 'copy' ? 'Copy to' : 'Move to'}
                actionLabel={transfer?.mode === 'copy' ? 'Copy here' : 'Move here'}
                busy={transferBusy}
                disks={disks}
                initialDisk={disk}
                onConfirm={(destDisk, dest) => transfer && moveTo(transfer.paths, destDisk, dest, transfer.mode)}
                onClose={() => setTransfer(null)}
            />
            {conflicts && conflictPending && (
                <ConflictDialog
                    conflicts={conflicts}
                    busy={transferBusy}
                    onCancel={() => {
                        setConflicts(null);
                        setConflictPending(null);
                    }}
                    onResolve={(resolutions) => {
                        const c = conflictPending;
                        setConflicts(null);
                        doMove(c.paths, c.destDisk, c.destination, c.mode, resolutions);
                    }}
                />
            )}
            {can.upload && (
                <UploadDialog
                    path={listing.path}
                    showTrigger={false}
                    open={uploadOpen}
                    onOpenChange={(o) => {
                        setUploadOpen(o);
                        if (!o) setDroppedFiles([]);
                    }}
                    initialFiles={droppedFiles}
                />
            )}
        </AppLayout>
        </DiskProvider>
    );
}

function DiskSwitcher({ disk, disks }: { disk: string; disks: DiskOption[] }) {
    const current = disks.find((d) => d.key === disk) ?? disks[0];
    return (
        <DM>
            <DMT asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <HardDrive className="size-4" />
                    <span className="max-w-32 truncate">{current?.label ?? 'Local'}</span>
                </Button>
            </DMT>
            <DMC align="start" className="min-w-44">
                {disks.map((d) => (
                    <DMI
                        key={d.key}
                        onSelect={() => router.get(route('files.index', d.key === 'local' ? {} : { disk: d.key }))}
                        className="gap-2"
                    >
                        <HardDrive className="size-4" />
                        <span className="flex-1 truncate">{d.label}</span>
                        {d.type !== 'local' && <span className="text-[10px] uppercase text-muted-foreground">{d.type}</span>}
                        {d.key === disk && <Check className="size-4 text-primary" />}
                    </DMI>
                ))}
            </DMC>
        </DM>
    );
}

function SortHeader({
    label,
    align = 'left',
    active,
    dir,
    onClick,
}: {
    label: string;
    align?: 'left' | 'right';
    active: boolean;
    dir: 'asc' | 'desc';
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''} ${active ? 'text-primary' : 'hover:text-foreground'}`}
        >
            {label}
            {active && (dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
        </button>
    );
}

function PathBreadcrumbs({
    crumbs,
    dragOver,
    setDragOver,
    onDropInto,
}: {
    crumbs: FileListing['breadcrumbs'];
    dragOver: string | null;
    setDragOver: (p: string | null) => void;
    onDropInto: (p: string) => void;
}) {
    const { params } = useActiveDisk();
    return (
        <nav className="inline-flex flex-wrap items-center gap-2 rounded border border-primary/20 bg-card/80 px-3 py-1.5 font-mono text-xs uppercase tracking-widest backdrop-blur-sm">
            {crumbs.map((crumb, i) => {
                const active = i === crumbs.length - 1;
                return (
                    <span key={crumb.path} className="flex items-center gap-2">
                        {i > 0 && <ChevronRight className="size-3 text-foreground/20" />}
                        <button
                            type="button"
                            onClick={() => router.get(route('files.index', { path: crumb.path, ...params }))}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragOver('crumb:' + crumb.path);
                            }}
                            onDragLeave={() => setDragOver(null)}
                            onDrop={() => onDropInto(crumb.path)}
                            className={`rounded px-1 transition-colors ${
                                active ? 'text-primary glow-text' : 'text-foreground/60 hover:text-primary'
                            } ${dragOver === 'crumb:' + crumb.path ? 'bg-primary/15 text-primary' : ''}`}
                        >
                            {i === 0 ? <Home className="size-3.5" /> : crumb.name}
                        </button>
                    </span>
                );
            })}
        </nav>
    );
}

function FileRow({
    entry,
    index,
    can,
    searchMode,
    selected,
    dragOver,
    onActivate,
    onToggle,
    onView,
    onInfo,
    onShare,
    onRename,
    onDelete,
    onMove,
    onCopy,
    onZip,
    isFav,
    onFavorite,
    onDragStart,
    setDragOver,
    onDropInto,
}: RowProps) {
    const isDir = entry.type === 'dir';
    const isDropTarget = isDir && !searchMode;

    return (
        <div
            draggable={!searchMode}
            onDragStart={onDragStart}
            onDragOver={isDropTarget ? (e) => { e.preventDefault(); setDragOver(entry.path); } : undefined}
            onDragLeave={isDropTarget ? () => setDragOver(null) : undefined}
            onDrop={isDropTarget ? () => onDropInto(entry.path) : undefined}
            className={`group grid grid-cols-[2.5rem_1fr_8rem_12rem_3rem] items-center gap-2 border-b border-primary/10 px-4 py-2.5 text-xs transition-colors last:border-0 ${
                selected ? 'bg-primary/10' : index % 2 === 1 ? 'bg-foreground/[0.02] hover:bg-primary/5' : 'hover:bg-primary/5'
            } ${dragOver ? 'glow-border bg-primary/15' : ''}`}
        >
            <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select ${entry.name}`} />

            <button type="button" onClick={(e) => onActivate(entry, index, e)} className="flex min-w-0 items-center gap-3 text-left">
                <FileIcon entry={entry} className={`size-5 shrink-0 ${isDir ? 'text-primary glow-text' : 'text-muted-foreground'}`} />
                <span className="truncate">{searchMode ? entry.path : entry.name}</span>
            </button>

            <span className="text-right text-muted-foreground">{formatBytes(entry.size)}</span>
            <span className="text-right text-muted-foreground">{formatDate(entry.modified)}</span>

            <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                            <MoreVertical className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <RowMenuItems
                            entry={entry}
                            can={can}
                            isFav={isFav}
                            onView={onView}
                            onInfo={onInfo}
                            onShare={onShare}
                            onRename={onRename}
                            onDelete={onDelete}
                            onMove={onMove}
                            onCopy={onCopy}
                            onZip={onZip}
                            onFavorite={onFavorite}
                        />
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif']);
const thumbUrl = (path: string, params: Record<string, string> = {}) => route('files.thumb', { path, ...params });

interface RowActions {
    onView: () => void;
    onInfo: () => void;
    onShare: () => void;
    onRename: () => void;
    onDelete: () => void;
    onMove: () => void;
    onCopy: () => void;
    onZip: () => void;
    onFavorite: () => void;
}

interface RowProps extends RowActions {
    entry: FileEntry;
    index: number;
    can: FilePermissions;
    searchMode: boolean;
    selected: boolean;
    dragOver: boolean;
    isFav: boolean;
    onActivate: (entry: FileEntry, index: number, e: React.MouseEvent) => void;
    onToggle: () => void;
    onDragStart: () => void;
    setDragOver: (p: string | null) => void;
    onDropInto: (p: string) => void;
}

function RowMenuItems({
    entry,
    can,
    isFav,
    onView,
    onInfo,
    onShare,
    onRename,
    onDelete,
    onMove,
    onCopy,
    onZip,
    onFavorite,
}: { entry: FileEntry; can: FilePermissions; isFav: boolean } & RowActions) {
    const isDir = entry.type === 'dir';
    const { params } = useActiveDisk();
    return (
        <>
            <DropdownMenuItem onSelect={onInfo}>
                <Info className="size-4" /> Info
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onFavorite}>
                <Star className={`size-4 ${isFav ? 'fill-primary text-primary' : ''}`} /> {isFav ? 'Unfavorite' : 'Favorite'}
            </DropdownMenuItem>
            {!isDir && (
                <DropdownMenuItem onSelect={onView}>
                    <Eye className="size-4" /> Preview
                </DropdownMenuItem>
            )}
            {!isDir && (
                <DropdownMenuItem asChild>
                    <a href={route('files.download', { path: entry.path, ...params })}>
                        <Download className="size-4" /> Download
                    </a>
                </DropdownMenuItem>
            )}
            {isDir && (
                <DropdownMenuItem onSelect={onZip}>
                    <FileArchive className="size-4" /> Download as zip
                </DropdownMenuItem>
            )}
            {!isDir && can.share && (
                <DropdownMenuItem onSelect={onShare}>
                    <Share2 className="size-4" /> Share…
                </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onMove}>
                <FolderInput className="size-4" /> Move to…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onCopy}>
                <Copy className="size-4" /> Copy to…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onRename}>
                <Pencil className="size-4" /> Rename
            </DropdownMenuItem>
            {can.delete && (
                <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="size-4" /> Delete
                </DropdownMenuItem>
            )}
        </>
    );
}

function GridCard({
    entry,
    index,
    can,
    searchMode,
    selected,
    dragOver,
    onActivate,
    onToggle,
    onView,
    onInfo,
    onShare,
    onRename,
    onDelete,
    onMove,
    onCopy,
    onZip,
    isFav,
    onFavorite,
    onDragStart,
    setDragOver,
    onDropInto,
}: RowProps) {
    const isDir = entry.type === 'dir';
    const isDropTarget = isDir && !searchMode;
    const isImage = entry.type === 'file' && entry.extension !== null && IMAGE_EXT.has(entry.extension);
    const [thumbFailed, setThumbFailed] = useState(false);
    const { params: diskParams } = useActiveDisk();

    return (
        <div
            draggable={!searchMode}
            onDragStart={onDragStart}
            onDragOver={isDropTarget ? (e) => { e.preventDefault(); setDragOver(entry.path); } : undefined}
            onDragLeave={isDropTarget ? () => setDragOver(null) : undefined}
            onDrop={isDropTarget ? () => onDropInto(entry.path) : undefined}
            className={`group relative flex flex-col overflow-hidden rounded border bg-card/60 backdrop-blur-sm transition-colors ${
                selected ? 'border-primary glow-border' : 'border-primary/25 hover:border-primary/50'
            } ${dragOver ? 'glow-border border-primary bg-primary/15' : ''}`}
        >
            {/* scanline texture */}
            <div className="pointer-events-none absolute inset-0 z-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.04)_2px,rgba(0,0,0,0.04)_4px)]" />

            {/* corner brackets */}
            <div className={`pointer-events-none absolute left-0 top-0 z-10 size-2.5 border-l-2 border-t-2 border-primary/60 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
            <div className={`pointer-events-none absolute right-0 top-0 z-10 size-2.5 border-r-2 border-t-2 border-primary/60 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
            <div className={`pointer-events-none absolute bottom-0 left-0 z-10 size-2.5 border-b-2 border-l-2 border-primary/60 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
            <div className={`pointer-events-none absolute bottom-0 right-0 z-10 size-2.5 border-b-2 border-r-2 border-primary/60 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

            <div className="absolute left-2 top-2 z-20 opacity-0 transition-opacity group-hover:opacity-100 data-[on=true]:opacity-100" data-on={selected}>
                <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select ${entry.name}`} className="bg-background/80" />
            </div>
            <div className="absolute right-1 top-1 z-20 opacity-0 transition-opacity group-hover:opacity-100">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7 bg-background/60">
                            <MoreVertical className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <RowMenuItems
                            entry={entry}
                            can={can}
                            isFav={isFav}
                            onView={onView}
                            onInfo={onInfo}
                            onShare={onShare}
                            onRename={onRename}
                            onDelete={onDelete}
                            onMove={onMove}
                            onCopy={onCopy}
                            onZip={onZip}
                            onFavorite={onFavorite}
                        />
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <button
                type="button"
                onClick={(e) => onActivate(entry, index, e)}
                className="relative z-0 flex aspect-square items-center justify-center overflow-hidden bg-background/30"
            >
                {isImage && !thumbFailed ? (
                    <img
                        src={thumbUrl(entry.path, diskParams)}
                        alt={entry.name}
                        loading="lazy"
                        onError={() => setThumbFailed(true)}
                        className="size-full object-cover"
                    />
                ) : (
                    <FileIcon entry={entry} className={`size-12 ${isDir ? 'text-primary glow-text' : 'text-muted-foreground/80'}`} />
                )}
            </button>
            <div className="relative z-0 flex items-center gap-1.5 border-t border-primary/15 px-2 py-1.5">
                <span className="text-primary">|</span>
                <p className="truncate font-mono text-[11px]" title={entry.name}>
                    {entry.name}
                </p>
            </div>
        </div>
    );
}

function NewFolderDialog({
    open,
    onOpenChange,
    path,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    path: string;
}) {
    const { params } = useActiveDisk();
    const { data, setData, post, processing, errors, reset, transform } = useForm({ name: '', path });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        transform((d) => ({ ...d, ...params }));
        post(route('files.folders.store'), {
            preserveScroll: true,
            onSuccess: () => {
                reset('name');
                onOpenChange(false);
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle className="font-mono uppercase tracking-widest">New folder</DialogTitle>
                        <DialogDescription>Create a folder in the current directory.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-4">
                        <Label htmlFor="folder-name">Folder name</Label>
                        <Input id="folder-name" autoFocus value={data.name} onChange={(e) => setData('name', e.target.value)} />
                        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={processing} className="glow-border">
                            Create
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function RenameDialog({ target, onClose }: { target: FileEntry | null; onClose: () => void }) {
    const { params } = useActiveDisk();
    const { data, setData, post, processing, errors, transform } = useForm({ name: '', path: '' });

    useEffect(() => {
        if (target) setData({ name: target.name, path: target.path });
    }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

    const submit = (e: FormEvent) => {
        e.preventDefault();
        transform((d) => ({ ...d, ...params }));
        post(route('files.rename'), { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle className="font-mono uppercase tracking-widest">Rename</DialogTitle>
                        <DialogDescription>Rename within the current directory.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-4">
                        <Label htmlFor="rename-name">New name</Label>
                        <Input id="rename-name" autoFocus value={data.name} onChange={(e) => setData('name', e.target.value)} />
                        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={processing} className="glow-border">
                            Rename
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DeleteDialog({
    targets,
    onClose,
    onDone,
}: {
    targets: FileEntry[] | null;
    onClose: () => void;
    onDone: () => void;
}) {
    const { params } = useActiveDisk();
    const [processing, setProcessing] = useState(false);
    const count = targets?.length ?? 0;

    const confirm = () => {
        if (!targets || count === 0) return;
        setProcessing(true);
        router.delete(route('files.destroy'), {
            data: { paths: targets.map((t) => t.path), ...params },
            preserveScroll: true,
            onFinish: () => {
                setProcessing(false);
                onDone();
                onClose();
            },
        });
    };

    return (
        <Dialog open={count > 0} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="font-mono uppercase tracking-widest">Delete</DialogTitle>
                    <DialogDescription>
                        {count === 1 ? (
                            <>
                                Delete <span className="font-semibold text-foreground">{targets![0].name}</span>
                                {targets![0].type === 'dir' ? ' and everything inside it' : ''}?
                            </>
                        ) : (
                            <>
                                Delete <span className="font-semibold text-foreground">{count} items</span>?
                            </>
                        )}{' '}
                        This cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="destructive" disabled={processing} onClick={confirm}>
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
