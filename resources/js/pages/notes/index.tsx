import { NoteEditor } from '@/components/notes/note-editor';
import { GridPanel } from '@/components/grid-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getXsrfToken } from '@/lib/csrf';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { ArrowLeft, Lock, Pin, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Note {
    id: number;
    body: string; // rich text HTML
    pinned: boolean;
    updated_at: string;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Notes', href: '/notes' }];

const headers = () => ({ 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': getXsrfToken() });

// Title = first block's text (Apple style); preview = the rest. Body is HTML.
const blocksOf = (html: string): string[] => {
    if (typeof document === 'undefined') return [];
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    return [...doc.body.children].map((el) => (el.textContent || '').trim()).filter(Boolean);
};
const titleOf = (html: string) => blocksOf(html)[0]?.slice(0, 80) || 'New note';
const previewOf = (html: string) => blocksOf(html).slice(1).join('  ').slice(0, 90) || 'No additional text';

const sortNotes = (list: Note[]) =>
    [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.updated_at) - +new Date(a.updated_at));

export default function Notes({ notes: initial }: { notes: Note[] }) {
    const [notes, setNotes] = useState<Note[]>(() => sortNotes(initial));
    const [selectedId, setSelectedId] = useState<number | null>(initial[0]?.id ?? null);
    const [query, setQuery] = useState('');
    const [saving, setSaving] = useState(false);
    const saveTimer = useRef<number | undefined>(undefined);

    const selected = notes.find((n) => n.id === selectedId) ?? null;

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? notes.filter((n) => n.body.toLowerCase().includes(q)) : notes;
    }, [notes, query]);

    const create = async () => {
        const res = await fetch(route('notes.store'), { method: 'POST', headers: headers() });
        const note: Note = await res.json();
        setNotes((prev) => sortNotes([note, ...prev]));
        setSelectedId(note.id);
    };

    const remove = async (id: number) => {
        await fetch(route('notes.destroy', id), { method: 'DELETE', headers: headers() });
        setNotes((prev) => {
            const next = prev.filter((n) => n.id !== id);
            if (id === selectedId) setSelectedId(next[0]?.id ?? null);
            return next;
        });
    };

    const persist = (id: number, data: Partial<Pick<Note, 'body' | 'pinned'>>) => {
        setSaving(true);
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
            fetch(route('notes.update', id), { method: 'PATCH', headers: headers(), body: JSON.stringify(data) })
                .catch(() => {})
                .finally(() => setSaving(false));
        }, 600);
    };

    const editBody = (id: number, body: string) => {
        const now = new Date().toISOString();
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, body, updated_at: now } : n)));
        persist(id, { body });
    };

    const togglePin = (n: Note) => {
        setNotes((prev) => sortNotes(prev.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x))));
        persist(n.id, { pinned: !n.pinned });
    };

    useEffect(() => () => window.clearTimeout(saveTimer.current), []);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Notes" />
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
                <div className="flex shrink-0 items-center justify-between">
                    <h1 className="flex items-center gap-2 font-mono text-lg uppercase tracking-widest text-primary glow-text">
                        Notes
                        <span title="Encrypted at rest">
                            <Lock className="size-4 text-muted-foreground" />
                        </span>
                    </h1>
                    <Button className="glow-border gap-2" onClick={create}>
                        <Plus className="size-4" /> New note
                    </Button>
                </div>

                <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[22rem_1fr]">
                    {/* List — hidden on mobile while a note is open (master-detail) */}
                    <GridPanel
                        label="NOTES"
                        className={cn('min-h-0 flex-col', selected ? 'hidden lg:flex' : 'flex')}
                        bodyClassName="flex min-h-0 flex-1 flex-col"
                    >
                        <div className="shrink-0 border-b border-primary/15 p-2">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes…" className="h-8 pl-8" />
                            </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {filtered.length === 0 ? (
                                <p className="px-4 py-12 text-center text-xs text-muted-foreground">{notes.length === 0 ? 'No notes yet.' : 'No match.'}</p>
                            ) : (
                                filtered.map((n) => (
                                    <button
                                        key={n.id}
                                        type="button"
                                        onClick={() => setSelectedId(n.id)}
                                        className={`flex w-full flex-col gap-0.5 border-b border-primary/10 px-3 py-2.5 text-left transition-colors hover:bg-primary/5 ${
                                            n.id === selectedId ? 'bg-primary/10' : ''
                                        }`}
                                    >
                                        <span className="flex items-center gap-1.5 truncate font-mono text-sm">
                                            {n.pinned && <Pin className="size-3 shrink-0 text-primary" />}
                                            <span className="truncate">{titleOf(n.body)}</span>
                                        </span>
                                        <span className="truncate text-xs text-muted-foreground">{previewOf(n.body)}</span>
                                        <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/40">
                                            {new Date(n.updated_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </GridPanel>

                    {/* Editor — full screen on mobile while a note is open */}
                    <GridPanel
                        label={selected ? titleOf(selected.body) : 'EDITOR'}
                        className={cn('min-h-0 flex-col', selected ? 'flex' : 'hidden lg:flex')}
                        bodyClassName="flex min-h-0 flex-1 flex-col"
                    >
                        {!selected ? (
                            <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
                                Select a note, or create one.
                            </div>
                        ) : (
                            <>
                                <div className="flex shrink-0 items-center gap-2 border-b border-primary/15 px-3 py-1.5">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 lg:hidden"
                                        title="Back to list"
                                        onClick={() => setSelectedId(null)}
                                    >
                                        <ArrowLeft className="size-4" />
                                    </Button>
                                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{saving ? 'Saving…' : 'Saved'}</span>
                                    <Button variant="ghost" size="icon" className="ml-auto size-7" title={selected.pinned ? 'Unpin' : 'Pin'} onClick={() => togglePin(selected)}>
                                        <Pin className={`size-4 ${selected.pinned ? 'text-primary' : 'text-muted-foreground'}`} />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" title="Delete" onClick={() => remove(selected.id)}>
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                                <NoteEditor noteId={selected.id} initialHtml={selected.body} onChange={(html) => editBody(selected.id, html)} />
                            </>
                        )}
                    </GridPanel>
                </div>
            </div>
        </AppLayout>
    );
}
