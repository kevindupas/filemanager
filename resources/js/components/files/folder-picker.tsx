import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, Folder, Home, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DirsResponse {
    path: string;
    breadcrumbs: Array<{ name: string; path: string }>;
    dirs: Array<{ name: string; path: string }>;
}

interface DiskOption {
    key: string;
    label: string;
    type: string;
}

/**
 * Navigable folder picker. Lets the user pick a destination DISK (local or any
 * connection) and a folder within it — enabling cross-disk move/copy.
 */
export function FolderPicker({
    open,
    title,
    actionLabel,
    busy,
    disks,
    initialDisk,
    onConfirm,
    onClose,
}: {
    open: boolean;
    title: string;
    actionLabel: string;
    busy?: boolean;
    disks: DiskOption[];
    initialDisk: string;
    onConfirm: (disk: string, destination: string) => void;
    onClose: () => void;
}) {
    const [selectedDisk, setSelectedDisk] = useState(initialDisk);
    const [path, setPath] = useState('');
    const [data, setData] = useState<DirsResponse | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setSelectedDisk(initialDisk);
            setPath('');
        }
    }, [open, initialDisk]);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        const params: Record<string, string> = { path };
        if (selectedDisk !== 'local') params.disk = selectedDisk;
        fetch(route('files.dirs', params), { headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [open, path, selectedDisk]);

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="font-mono uppercase tracking-widest">{title}</DialogTitle>
                    <DialogDescription>Pick a destination disk and folder.</DialogDescription>
                </DialogHeader>

                {/* Destination disk */}
                <Select
                    value={selectedDisk}
                    onValueChange={(v) => {
                        setSelectedDisk(v);
                        setPath('');
                    }}
                >
                    <SelectTrigger>
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

                {/* Breadcrumb of the picker location */}
                <nav className="flex flex-wrap items-center gap-1 font-mono text-sm">
                    {(data?.breadcrumbs ?? [{ name: 'Home', path: '' }]).map((c, i) => (
                        <span key={c.path} className="flex items-center gap-1">
                            {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
                            <button
                                type="button"
                                onClick={() => setPath(c.path)}
                                className="rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:text-primary"
                            >
                                {i === 0 ? <Home className="size-4" /> : c.name}
                            </button>
                        </span>
                    ))}
                </nav>

                <div className="max-h-64 min-h-32 overflow-y-auto rounded-lg border border-border">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="size-5 animate-spin text-primary" />
                        </div>
                    ) : data && data.dirs.length > 0 ? (
                        data.dirs.map((dir) => (
                            <button
                                key={dir.path}
                                type="button"
                                onClick={() => setPath(dir.path)}
                                className="flex w-full items-center gap-3 border-b border-border/40 px-3 py-2 text-left text-sm transition-colors last:border-0 hover:bg-primary/5"
                            >
                                <Folder className="size-4 shrink-0 text-primary glow-text" />
                                <span className="truncate">{dir.name}</span>
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-10 text-center text-sm text-muted-foreground">No subfolders here.</div>
                    )}
                </div>

                <DialogFooter className="sm:justify-between">
                    <span className="self-center font-mono text-xs text-muted-foreground">
                        → {selectedDisk}:/{data?.path ?? ''}
                    </span>
                    <Button className="glow-border gap-2" disabled={busy} onClick={() => onConfirm(selectedDisk, data?.path ?? path)}>
                        {busy && <Loader2 className="size-4 animate-spin" />}
                        {actionLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
