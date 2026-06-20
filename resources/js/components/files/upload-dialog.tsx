import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useActiveDisk } from '@/hooks/use-active-disk';
import { getXsrfToken } from '@/lib/csrf';
import { formatBytes } from '@/lib/format';
import { router } from '@inertiajs/react';
import { CheckCircle2, CloudUpload, Loader2, Upload, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Resumable from 'resumablejs';

interface UploadItem {
    id: string;
    name: string;
    size: number;
    progress: number; // 0..1
    status: 'uploading' | 'done' | 'error';
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks

export function UploadDialog({
    path,
    open: controlledOpen,
    onOpenChange,
    initialFiles,
    showTrigger = true,
}: {
    path: string;
    open?: boolean;
    onOpenChange?: (o: boolean) => void;
    initialFiles?: File[];
    showTrigger?: boolean;
}) {
    const { params: diskParams } = useActiveDisk();
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen ?? internalOpen;
    const setOpen = (o: boolean) => (onOpenChange ? onOpenChange(o) : setInternalOpen(o));

    const [dragging, setDragging] = useState(false);
    const [items, setItems] = useState<UploadItem[]>([]);
    const dropRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const resumableRef = useRef<Resumable | null>(null);

    // The target path can change as the user navigates; keep it fresh for the
    // query without re-creating the Resumable instance.
    const pathRef = useRef(path);
    pathRef.current = path;
    const diskRef = useRef(diskParams);
    diskRef.current = diskParams;

    useEffect(() => {
        if (!open) return;

        const r = new Resumable({
            target: '/files/upload',
            chunkSize: CHUNK_SIZE,
            simultaneousUploads: 3,
            testChunks: true, // lets pion skip already-received chunks on resume
            fileParameterName: 'file',
            headers: { 'X-XSRF-TOKEN': getXsrfToken(), Accept: 'application/json' },
            query: () => ({ path: pathRef.current, ...diskRef.current }),
        });

        r.on('fileAdded', () => r.upload());
        r.on('filesAdded', (files) => {
            setItems((prev) => [
                ...prev,
                ...files.map((f) => ({
                    id: f.uniqueIdentifier,
                    name: f.fileName,
                    size: f.size,
                    progress: 0,
                    status: 'uploading' as const,
                })),
            ]);
        });
        r.on('fileProgress', (file) => {
            setItems((prev) =>
                prev.map((it) => (it.id === file.uniqueIdentifier ? { ...it, progress: file.progress(false) } : it)),
            );
        });
        r.on('fileSuccess', (file) => {
            setItems((prev) =>
                prev.map((it) => (it.id === file.uniqueIdentifier ? { ...it, progress: 1, status: 'done' } : it)),
            );
        });
        r.on('fileError', (file) => {
            setItems((prev) =>
                prev.map((it) => (it.id === file.uniqueIdentifier ? { ...it, status: 'error' } : it)),
            );
        });
        r.on('complete', () => {
            // Refresh the listing once the whole batch is in.
            router.reload({ only: ['listing'] });
        });

        resumableRef.current = r;

        // Files handed in from a drag-drop onto the page start immediately.
        if (initialFiles?.length) r.addFiles(initialFiles);

        return () => {
            r.cancel();
            resumableRef.current = null;
        };
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const activeCount = items.filter((i) => i.status === 'uploading').length;

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) setItems([]);
            }}
        >
            {showTrigger && (
                <DialogTrigger asChild>
                    <Button
                        variant="outline"
                        className="gap-2 border-primary bg-primary text-primary-foreground hover:bg-primary/85 hover:text-primary-foreground"
                    >
                        <Upload className="size-4" />
                        Upload
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="font-mono uppercase tracking-widest">Upload files</DialogTitle>
                    <DialogDescription>
                        Large files are uploaded in {formatBytes(CHUNK_SIZE)} resumable chunks.
                    </DialogDescription>
                </DialogHeader>

                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length) resumableRef.current?.addFiles(files);
                        e.target.value = ''; // allow re-selecting the same file
                    }}
                />
                <div
                    ref={dropRef}
                    role="button"
                    tabIndex={0}
                    onClick={() => inputRef.current?.click()}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={(e) => {
                        e.preventDefault();
                        setDragging(false);
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        const files = Array.from(e.dataTransfer.files);
                        if (files.length) resumableRef.current?.addFiles(files);
                    }}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                        dragging ? 'border-primary bg-primary/5 glow-border' : 'border-border'
                    }`}
                >
                    <CloudUpload className="size-10 text-primary glow-text" />
                    <p className="text-sm text-muted-foreground">Drag &amp; drop files here, or</p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            inputRef.current?.click();
                        }}
                    >
                        Browse…
                    </Button>
                </div>

                {items.length > 0 && (
                    <div className="max-h-56 space-y-2 overflow-y-auto">
                        {items.map((it) => (
                            <div key={it.id} className="rounded-md border border-border p-2">
                                <div className="flex items-center gap-2 text-sm">
                                    {it.status === 'uploading' && <Loader2 className="size-4 animate-spin text-primary" />}
                                    {it.status === 'done' && <CheckCircle2 className="size-4 text-primary" />}
                                    {it.status === 'error' && <XCircle className="size-4 text-destructive" />}
                                    <span className="flex-1 truncate">{it.name}</span>
                                    <span className="text-xs text-muted-foreground">{formatBytes(it.size)}</span>
                                </div>
                                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                        className={`h-full rounded-full transition-all ${
                                            it.status === 'error' ? 'bg-destructive' : 'bg-primary'
                                        }`}
                                        style={{
                                            width: `${Math.round(it.progress * 100)}%`,
                                            boxShadow: it.status === 'error' ? undefined : '0 0 8px var(--glow)',
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeCount > 0 && (
                    <p className="text-center text-xs text-muted-foreground">{activeCount} upload(s) in progress…</p>
                )}
            </DialogContent>
        </Dialog>
    );
}
