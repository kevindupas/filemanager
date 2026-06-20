import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useActiveDisk } from '@/hooks/use-active-disk';
import { getXsrfToken } from '@/lib/csrf';
import { formatBytes } from '@/lib/format';
import { type FileEntry } from '@/types';
import { ChevronLeft, ChevronRight, Download, FileQuestion, Loader2, Pencil, Save, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Kind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'none';

const KIND: Record<string, Kind> = {
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', avif: 'image',
    mp4: 'video', webm: 'video', mov: 'video', mkv: 'video', ogv: 'video',
    mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', m4a: 'audio',
    pdf: 'pdf',
    txt: 'text', md: 'text', json: 'text', js: 'text', ts: 'text', tsx: 'text', jsx: 'text', css: 'text',
    html: 'text', php: 'text', py: 'text', go: 'text', rs: 'text', sh: 'text', csv: 'text', log: 'text',
    xml: 'text', yml: 'text', yaml: 'text', env: 'text', sql: 'text',
};

const kindOf = (e: FileEntry | null): Kind => (e ? (KIND[e.extension ?? ''] ?? 'none') : 'none');

const MAX_TEXT_BYTES = 2 * 1024 * 1024; // don't inline-render huge text files

export function FileViewer({
    target,
    onClose,
    canEdit = false,
    gallery = [],
}: {
    target: FileEntry | null;
    onClose: () => void;
    canEdit?: boolean;
    gallery?: FileEntry[];
}) {
    const { params } = useActiveDisk();

    // `current` lets the image gallery step through siblings without the parent.
    const [current, setCurrent] = useState<FileEntry | null>(target);
    useEffect(() => setCurrent(target), [target]);

    const kind = kindOf(current);
    const src = current ? route('files.preview', { path: current.path, ...params }) : '';
    const downloadUrl = current ? route('files.download', { path: current.path, ...params }) : '';

    const images = useMemo(() => gallery.filter((e) => e.type === 'file' && kindOf(e) === 'image'), [gallery]);
    const imgIndex = current ? images.findIndex((e) => e.path === current.path) : -1;
    const hasGallery = kind === 'image' && imgIndex >= 0 && images.length > 1;

    const step = useCallback(
        (delta: number) => {
            if (imgIndex < 0 || !images.length) return;
            setCurrent(images[(imgIndex + delta + images.length) % images.length]);
        },
        [imgIndex, images],
    );

    const [text, setText] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setText(null);
        setEditing(false);
        if (!current || kind !== 'text') return;
        if ((current.size ?? 0) > MAX_TEXT_BYTES) return;

        setLoading(true);
        fetch(src)
            .then((r) => r.text())
            .then(setText)
            .catch(() => setText('// Failed to load file.'))
            .finally(() => setLoading(false));
    }, [current, kind, src]);

    // Arrow keys flip through the gallery (when not editing text).
    useEffect(() => {
        if (!hasGallery || editing) return;
        const h = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') step(1);
            if (e.key === 'ArrowLeft') step(-1);
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [hasGallery, editing, step]);

    const save = () => {
        if (!current) return;
        setSaving(true);
        fetch(route('files.save'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': getXsrfToken() },
            body: JSON.stringify({ path: current.path, content: draft, ...params }),
        })
            .then((r) => {
                if (!r.ok) throw new Error();
                setText(draft);
                setEditing(false);
                toast.success('File saved.');
            })
            .catch(() => toast.error('Save failed.'))
            .finally(() => setSaving(false));
    };

    const tooBigText = kind === 'text' && (current?.size ?? 0) > MAX_TEXT_BYTES;

    return (
        <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-h-[90vh] gap-4 overflow-hidden sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="truncate pr-8 font-mono">
                        {current?.name}
                        {hasGallery && <span className="ml-2 text-xs text-muted-foreground">({imgIndex + 1}/{images.length})</span>}
                    </DialogTitle>
                </DialogHeader>

                <div className="relative flex max-h-[65vh] min-h-40 items-center justify-center overflow-auto rounded-lg border border-border bg-background/60 p-2">
                    {hasGallery && (
                        <>
                            <button
                                type="button"
                                onClick={() => step(-1)}
                                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-primary/40 bg-card/80 p-1.5 text-primary backdrop-blur-sm hover:bg-primary/20"
                            >
                                <ChevronLeft className="size-5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => step(1)}
                                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-primary/40 bg-card/80 p-1.5 text-primary backdrop-blur-sm hover:bg-primary/20"
                            >
                                <ChevronRight className="size-5" />
                            </button>
                        </>
                    )}

                    {kind === 'image' && <img src={src} alt={current?.name} className="max-h-[60vh] object-contain" />}

                    {kind === 'video' && <video src={src} controls className="max-h-[60vh] w-full" />}

                    {kind === 'audio' && <audio src={src} controls className="w-full" />}

                    {kind === 'pdf' && <iframe src={src} title={current?.name} className="h-[65vh] w-full" />}

                    {kind === 'text' &&
                        (tooBigText ? (
                            <Fallback />
                        ) : loading ? (
                            <Loader2 className="size-6 animate-spin text-primary" />
                        ) : editing ? (
                            <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                spellCheck={false}
                                className="h-[60vh] w-full resize-none rounded border border-primary/30 bg-background p-2 text-left font-mono text-xs outline-none focus:border-primary"
                            />
                        ) : (
                            <pre className="w-full overflow-auto whitespace-pre-wrap break-words p-2 text-left font-mono text-xs">{text}</pre>
                        ))}

                    {kind === 'none' && <Fallback />}
                </div>

                <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{formatBytes(current?.size ?? null)}</span>
                    <div className="flex gap-2">
                        {kind === 'text' && !tooBigText && canEdit && !editing && (
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={() => {
                                    setDraft(text ?? '');
                                    setEditing(true);
                                }}
                            >
                                <Pencil className="size-4" /> Edit
                            </Button>
                        )}
                        {editing && (
                            <>
                                <Button variant="outline" className="gap-2" disabled={saving} onClick={() => setEditing(false)}>
                                    <X className="size-4" /> Cancel
                                </Button>
                                <Button className="glow-border gap-2" disabled={saving} onClick={save}>
                                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
                                </Button>
                            </>
                        )}
                        {!editing && (
                            <Button asChild variant="outline" className="gap-2">
                                <a href={downloadUrl}>
                                    <Download className="size-4" /> Download
                                </a>
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function Fallback() {
    return (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <FileQuestion className="size-10" />
            <p>No inline preview for this file type.</p>
        </div>
    );
}
