import { GridPanel } from '@/components/grid-panel';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { getXsrfToken } from '@/lib/csrf';
import { formatBytes, formatDate } from '@/lib/format';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { ArrowLeft, Download, Eye, File, Folder, FolderOpen, FolderPlus, MessageSquare, Pencil, Send, Trash2, Upload, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Grant {
    id: number;
    owner: string;
    owner_id: number;
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

interface Comment {
    id: number;
    author: string;
    body: string;
    created_at: string | null;
    can_delete: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Shared with me', href: '/shared' }];

const headers = () => ({ 'X-XSRF-TOKEN': getXsrfToken() });
const jsonHeaders = () => ({ 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': getXsrfToken() });

export default function SharedIndex({ grants }: { grants: Grant[] }) {
    const [active, setActive] = useState<Grant | null>(null);
    const [path, setPath] = useState('');
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(false);
    const [commentTarget, setCommentTarget] = useState<{ path: string; name: string } | null>(null);
    const uploadRef = useRef<HTMLInputElement>(null);

    const write = active?.permission === 'write';

    const load = (g: Grant, p: string) => {
        setLoading(true);
        fetch(`/shared/${g.id}/list?path=${encodeURIComponent(p)}`, { headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((d) => setEntries(d.entries ?? []))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (active && active.is_dir) load(active, path);
    }, [active, path]);  

    const openFolder = (g: Grant) => {
        setActive(g);
        setPath(g.path);
    };

    const downloadUrl = (g: Grant, p: string) => `/shared/${g.id}/download?path=${encodeURIComponent(p)}`;
    const previewUrl = (g: Grant, p: string) => `/shared/${g.id}/preview?path=${encodeURIComponent(p)}`;

    const newFolder = async () => {
        if (!active) return;
        const name = window.prompt('New folder name');
        if (!name) return;
        await fetch(`/shared/${active.id}/folders`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ path, name }) });
        load(active, path);
    };

    const uploadFiles = async (files: FileList | null) => {
        if (!active || !files?.length) return;
        for (const file of Array.from(files)) {
            const form = new FormData();
            form.append('path', path);
            form.append('file', file);
            await fetch(`/shared/${active.id}/upload`, { method: 'POST', headers: headers(), body: form });
        }
        load(active, path);
    };

    const rename = async (e: Entry) => {
        if (!active) return;
        const name = window.prompt('Rename to', e.name);
        if (!name || name === e.name) return;
        await fetch(`/shared/${active.id}/rename`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ path: e.path, name }) });
        load(active, path);
    };

    const remove = async (e: Entry) => {
        if (!active || !window.confirm(`Delete “${e.name}”? It moves to the owner's trash.`)) return;
        await fetch(`/shared/${active.id}`, { method: 'DELETE', headers: jsonHeaders(), body: JSON.stringify({ path: e.path }) });
        load(active, path);
    };

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
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => setActive(null)}>
                                <ArrowLeft className="size-4" /> Back
                            </Button>
                            <span className="flex-1 text-sm text-muted-foreground">
                                <span className="text-foreground">{active.name}</span>
                                {relPath && ` / ${relPath}`}
                            </span>
                            {active.is_dir && write && (
                                <>
                                    <input ref={uploadRef} type="file" multiple hidden onChange={(e) => uploadFiles(e.target.files)} />
                                    <Button variant="outline" size="sm" className="gap-2" onClick={newFolder}>
                                        <FolderPlus className="size-4" /> New folder
                                    </Button>
                                    <Button size="sm" className="gap-2" onClick={() => uploadRef.current?.click()}>
                                        <Upload className="size-4" /> Upload
                                    </Button>
                                </>
                            )}
                        </div>

                        {!active.is_dir ? (
                            <GridPanel label="FILE">
                                <div className="flex items-center gap-3 p-4">
                                    <File className="size-10 text-muted-foreground" />
                                    <span className="flex-1 font-medium">{active.name}</span>
                                    <Button variant="ghost" size="icon" className="size-9" onClick={() => setCommentTarget({ path: active.path, name: active.name })}>
                                        <MessageSquare className="size-4" />
                                    </Button>
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
                                                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setCommentTarget({ path: e.path, name: e.name })}>
                                                            <MessageSquare className="size-4" />
                                                        </Button>
                                                        <a href={previewUrl(active, e.path)} target="_blank" rel="noreferrer">
                                                            <Button variant="ghost" size="icon" className="size-8"><Eye className="size-4" /></Button>
                                                        </a>
                                                        <a href={downloadUrl(active, e.path)}>
                                                            <Button variant="ghost" size="icon" className="size-8"><Download className="size-4" /></Button>
                                                        </a>
                                                    </>
                                                )}
                                                {write && (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="size-8" onClick={() => rename(e)}>
                                                            <Pencil className="size-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => remove(e)}>
                                                            <Trash2 className="size-4" />
                                                        </Button>
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

            {active && commentTarget && (
                <CommentsDialog
                    ownerId={active.owner_id}
                    target={commentTarget}
                    onClose={() => setCommentTarget(null)}
                />
            )}
        </AppLayout>
    );
}

function CommentsDialog({ ownerId, target, onClose }: { ownerId: number; target: { path: string; name: string }; onClose: () => void }) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    const reload = () => {
        setLoading(true);
        fetch(`/comments?owner=${ownerId}&path=${encodeURIComponent(target.path)}`, { headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then(setComments)
            .finally(() => setLoading(false));
    };

    useEffect(reload, [ownerId, target.path]);  

    const send = async () => {
        if (!body.trim()) return;
        setSending(true);
        const res = await fetch('/comments', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({ owner_id: ownerId, path: target.path, body }),
        });
        setSending(false);
        if (res.ok) {
            const c = await res.json();
            setComments((prev) => [...prev, c]);
            setBody('');
        }
    };

    const remove = async (id: number) => {
        await fetch(`/comments/${id}`, { method: 'DELETE', headers: jsonHeaders() });
        setComments((prev) => prev.filter((c) => c.id !== id));
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="truncate pr-8 font-mono">Comments — {target.name}</DialogTitle>
                    <DialogDescription>Visible to the owner and everyone this file is shared with.</DialogDescription>
                </DialogHeader>

                <div className="max-h-72 space-y-2 overflow-y-auto">
                    {loading ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
                    ) : comments.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">No comments yet.</p>
                    ) : (
                        comments.map((c) => (
                            <div key={c.id} className="rounded-md border border-border p-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium">{c.author}</span>
                                    <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                        {c.created_at}
                                        {c.can_delete && (
                                            <button type="button" className="text-destructive hover:underline" onClick={() => remove(c.id)}>
                                                delete
                                            </button>
                                        )}
                                    </span>
                                </div>
                                <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex items-end gap-2">
                    <Input
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                        placeholder="Write a comment…"
                    />
                    <Button size="icon" className="size-9 shrink-0" disabled={sending || !body.trim()} onClick={send}>
                        <Send className="size-4" />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
