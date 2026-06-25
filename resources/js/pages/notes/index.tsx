import { GridPanel } from '@/components/grid-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getXsrfToken } from '@/lib/csrf';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import {
    Bold,
    Code,
    Eye,
    Heading1,
    Heading2,
    Italic,
    Link2,
    List,
    ListChecks,
    ListOrdered,
    Lock,
    Pencil,
    Pin,
    Plus,
    Quote,
    Search,
    Table,
    Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Note {
    id: number;
    body: string;
    pinned: boolean;
    updated_at: string;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Notes', href: '/notes' }];

const headers = () => ({ 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': getXsrfToken() });

const titleOf = (body: string) => body.split('\n').find((l) => l.trim())?.trim().slice(0, 80) || 'New note';
const previewOf = (body: string) => {
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.slice(1).join('  ').slice(0, 90) || 'No additional text';
};
const sortNotes = (list: Note[]) =>
    [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.updated_at) - +new Date(a.updated_at));

export default function Notes({ notes: initial }: { notes: Note[] }) {
    const [notes, setNotes] = useState<Note[]>(() => sortNotes(initial));
    const [selectedId, setSelectedId] = useState<number | null>(initial[0]?.id ?? null);
    const [query, setQuery] = useState('');
    const [mode, setMode] = useState<'edit' | 'preview'>('edit');
    const [saving, setSaving] = useState(false);
    const saveTimer = useRef<number | undefined>(undefined);
    const taRef = useRef<HTMLTextAreaElement>(null);

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
        setMode('edit');
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

    const editBody = (body: string) => {
        if (!selected) return;
        const now = new Date().toISOString();
        setNotes((prev) => prev.map((n) => (n.id === selected.id ? { ...n, body, updated_at: now } : n)));
        persist(selected.id, { body });
    };

    // Toolbar: insert/wrap markdown at the cursor in the editor textarea.
    const applyFormat = (kind: string) => {
        const ta = taRef.current;
        if (!ta || !selected) return;
        const value = selected.body;
        const s = ta.selectionStart;
        const e = ta.selectionEnd;
        const sel = value.slice(s, e);

        const wrap = (before: string, after = before) => ({
            next: value.slice(0, s) + before + sel + after + value.slice(e),
            sel: [s + before.length, s + before.length + sel.length] as [number, number],
        });
        const linePrefix = (prefix: string) => {
            const lineStart = value.lastIndexOf('\n', s - 1) + 1;
            const block = value.slice(lineStart, e);
            const prefixed = block.split('\n').map((l) => prefix + l).join('\n');
            const next = value.slice(0, lineStart) + prefixed + value.slice(e);
            return { next, pos: e + (prefixed.length - block.length) };
        };
        const insertAt = (text: string) => ({ next: value.slice(0, s) + text + value.slice(e), pos: s + text.length });

        let r: { next: string; pos?: number; sel?: [number, number] };
        switch (kind) {
            case 'h1': r = linePrefix('# '); break;
            case 'h2': r = linePrefix('## '); break;
            case 'bold': r = wrap('**'); break;
            case 'italic': r = wrap('*'); break;
            case 'ul': r = linePrefix('- '); break;
            case 'ol': r = linePrefix('1. '); break;
            case 'check': r = linePrefix('- [ ] '); break;
            case 'quote': r = linePrefix('> '); break;
            case 'code': r = sel.includes('\n') ? wrap('```\n', '\n```') : wrap('`'); break;
            case 'link': r = wrap('[', '](https://)'); break;
            case 'table': r = insertAt('\n\n| Col 1 | Col 2 |\n| --- | --- |\n|  |  |\n\n'); break;
            default: return;
        }

        editBody(r.next);
        requestAnimationFrame(() => {
            ta.focus();
            if (r.sel) ta.setSelectionRange(r.sel[0], r.sel[1]);
            else if (r.pos !== undefined) ta.setSelectionRange(r.pos, r.pos);
        });
    };

    const togglePin = (n: Note) => {
        setNotes((prev) => sortNotes(prev.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x))));
        persist(n.id, { pinned: !n.pinned });
    };

    // Flush a pending save when leaving the page.
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
                    {/* List */}
                    <GridPanel label="NOTES" className="flex min-h-0 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">
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

                    {/* Editor */}
                    <GridPanel
                        label={selected ? titleOf(selected.body) : 'EDITOR'}
                        className="flex min-h-0 flex-col"
                        bodyClassName="flex min-h-0 flex-1 flex-col"
                    >
                        {!selected ? (
                            <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
                                Select a note, or create one.
                            </div>
                        ) : (
                            <>
                                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-primary/15 px-2 py-1.5">
                                    <div className="flex rounded border border-border">
                                        <button
                                            type="button"
                                            onClick={() => setMode('edit')}
                                            className={`flex items-center gap-1 rounded-l px-2 py-1 text-xs ${mode === 'edit' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}
                                        >
                                            <Pencil className="size-3.5" /> Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMode('preview')}
                                            className={`flex items-center gap-1 rounded-r px-2 py-1 text-xs ${mode === 'preview' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}
                                        >
                                            <Eye className="size-3.5" /> Preview
                                        </button>
                                    </div>
                                    <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                        {saving ? 'Saving…' : 'Saved'}
                                    </span>
                                    <Button variant="ghost" size="icon" className="size-7" title={selected.pinned ? 'Unpin' : 'Pin'} onClick={() => togglePin(selected)}>
                                        <Pin className={`size-4 ${selected.pinned ? 'text-primary' : 'text-muted-foreground'}`} />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" title="Delete" onClick={() => remove(selected.id)}>
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>

                                {mode === 'edit' && (
                                    <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-primary/10 px-2 py-1">
                                        {(
                                            [
                                                ['h1', Heading1, 'Title'],
                                                ['h2', Heading2, 'Subtitle'],
                                                ['bold', Bold, 'Bold'],
                                                ['italic', Italic, 'Italic'],
                                                ['ul', List, 'Bullet list'],
                                                ['ol', ListOrdered, 'Numbered list'],
                                                ['check', ListChecks, 'Checklist'],
                                                ['quote', Quote, 'Quote'],
                                                ['code', Code, 'Code'],
                                                ['table', Table, 'Table'],
                                                ['link', Link2, 'Link'],
                                            ] as const
                                        ).map(([k, Icon, label]) => (
                                            <button
                                                key={k}
                                                type="button"
                                                title={label}
                                                onClick={() => applyFormat(k)}
                                                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                                            >
                                                <Icon className="size-4" />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {mode === 'edit' ? (
                                    <textarea
                                        ref={taRef}
                                        value={selected.body}
                                        onChange={(e) => editBody(e.target.value)}
                                        autoFocus
                                        spellCheck={false}
                                        placeholder="# Title on the first line&#10;&#10;Write in markdown…"
                                        className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed outline-none"
                                    />
                                ) : (
                                    <div className="markdown-body min-h-0 flex-1 overflow-y-auto p-4 text-sm">
                                        <Markdown remarkPlugins={[remarkGfm]}>{selected.body || '*Empty note*'}</Markdown>
                                    </div>
                                )}
                            </>
                        )}
                    </GridPanel>
                </div>
            </div>
        </AppLayout>
    );
}
