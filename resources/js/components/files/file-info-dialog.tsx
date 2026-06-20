import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useActiveDisk } from '@/hooks/use-active-disk';
import { formatBytes, formatDate } from '@/lib/format';
import { type FileEntry } from '@/types';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface FileInfo {
    name: string;
    path: string;
    type: 'dir' | 'file';
    size: number;
    modified: number;
    created: number | null;
    permissions: string;
    readable: boolean;
    writable: boolean;
    mime?: string;
    extension?: string;
    image?: { width: number; height: number };
    exif?: Record<string, string | number>;
    sha256?: string;
    fileCount?: number;
    folderCount?: number;
}

const EXIF_LABELS: Record<string, string> = {
    camera: 'Camera',
    taken_at: 'Taken at',
    iso: 'ISO',
    exposure: 'Exposure',
    aperture: 'Aperture',
    orientation: 'Orientation',
};

export function FileInfoDialog({ target, onClose }: { target: FileEntry | null; onClose: () => void }) {
    const { params } = useActiveDisk();
    const [info, setInfo] = useState<FileInfo | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setInfo(null);
        if (!target) return;
        setLoading(true);
        fetch(route('files.info', { path: target.path, ...params }), { headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then(setInfo)
            .catch(() => setInfo(null))
            .finally(() => setLoading(false));
    }, [target]);

    const rows: Array<[string, React.ReactNode]> = [];
    if (info) {
        rows.push(['Type', info.type === 'dir' ? 'Folder' : (info.mime ?? 'file')]);
        if (info.type === 'dir') {
            rows.push(['Contents', `${info.fileCount} files · ${info.folderCount} folders`]);
            rows.push(['Total size', formatBytes(info.size)]);
        } else {
            rows.push(['Size', `${formatBytes(info.size)} (${info.size.toLocaleString()} bytes)`]);
            if (info.extension) rows.push(['Extension', `.${info.extension}`]);
            if (info.image) rows.push(['Dimensions', `${info.image.width} × ${info.image.height} px`]);
        }
        rows.push(['Modified', formatDate(info.modified)]);
        if (info.created) rows.push(['Created', formatDate(info.created)]);
        rows.push(['Permissions', info.permissions]);
        rows.push(['Access', `${info.readable ? 'read' : '—'} / ${info.writable ? 'write' : 'read-only'}`]);
    }

    return (
        <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="truncate pr-8 font-mono">{target?.name}</DialogTitle>
                </DialogHeader>

                {loading || !info ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="size-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <dl className="divide-y divide-border/40 rounded-lg border border-border">
                            {rows.map(([label, value]) => (
                                <div key={label} className="grid grid-cols-[8rem_1fr] gap-2 px-3 py-2 text-sm">
                                    <dt className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                                        {label}
                                    </dt>
                                    <dd className="break-words">{value}</dd>
                                </div>
                            ))}
                        </dl>

                        {info.exif && Object.keys(info.exif).length > 0 && (
                            <div>
                                <p className="mb-1 font-mono text-xs uppercase tracking-widest text-primary glow-text">
                                    EXIF
                                </p>
                                <dl className="divide-y divide-border/40 rounded-lg border border-border">
                                    {Object.entries(info.exif).map(([k, v]) => (
                                        <div key={k} className="grid grid-cols-[8rem_1fr] gap-2 px-3 py-2 text-sm">
                                            <dt className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                                                {EXIF_LABELS[k] ?? k}
                                            </dt>
                                            <dd className="break-words">{String(v)}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        )}

                        {info.sha256 && (
                            <div>
                                <p className="mb-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                                    SHA-256
                                </p>
                                <code className="block break-all rounded-md border border-border bg-background/60 p-2 text-xs">
                                    {info.sha256}
                                </code>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
