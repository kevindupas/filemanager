import { GridPanel } from '@/components/grid-panel';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { Bell, CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';

interface Task {
    id: number;
    title: string;
    description: string | null;
    priority: 'low' | 'normal' | 'high';
    due_at: string | null;
    remind_at: string | null;
    done: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Tasks', href: '/tasks' }];

const PRIORITY_TONE: Record<string, string> = {
    high: 'text-destructive',
    normal: 'text-muted-foreground',
    low: 'text-muted-foreground/60',
};

/** ISO → value for <input type="datetime-local"> (local, minute precision). */
function toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmt(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function TasksIndex({ tasks }: { tasks: Task[] }) {
    const [editing, setEditing] = useState<Task | null>(null);

    const add = useForm({ title: '', priority: 'normal', due_at: '', remind_at: '' });

    const submitAdd = (e: FormEvent) => {
        e.preventDefault();
        add.post(route('tasks.store'), { preserveScroll: true, onSuccess: () => add.reset() });
    };

    const toggle = (t: Task) => router.patch(route('tasks.update', t.id), { done: !t.done }, { preserveScroll: true });
    const remove = (t: Task) => router.delete(route('tasks.destroy', t.id), { preserveScroll: true });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tasks" />

            <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 p-4">
                <h1 className="shrink-0 font-mono text-lg uppercase tracking-widest text-primary glow-text">Tasks</h1>

                <form onSubmit={submitAdd} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
                    <div className="grid min-w-48 flex-1 gap-1.5">
                        <Label>New task</Label>
                        <Input value={add.data.title} onChange={(e) => add.setData('title', e.target.value)} placeholder="What needs doing?" />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Priority</Label>
                        <Select value={add.data.priority} onValueChange={(v) => add.setData('priority', v)}>
                            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Due</Label>
                        <Input type="datetime-local" className="w-44" value={add.data.due_at} onChange={(e) => add.setData('due_at', e.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Remind</Label>
                        <Input type="datetime-local" className="w-44" value={add.data.remind_at} onChange={(e) => add.setData('remind_at', e.target.value)} />
                    </div>
                    <Button type="submit" disabled={add.processing || !add.data.title} className="gap-2">
                        <Plus className="size-4" /> Add
                    </Button>
                </form>

                {tasks.length === 0 ? (
                    <GridPanel label="TASKS">
                        <div className="px-4 py-16 text-center text-sm text-muted-foreground">No tasks yet.</div>
                    </GridPanel>
                ) : (
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {tasks.map((t) => (
                            <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                                <Checkbox checked={t.done} onCheckedChange={() => toggle(t)} className="shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <div className={`truncate ${t.done ? 'text-muted-foreground line-through' : ''}`}>
                                        <span className={PRIORITY_TONE[t.priority]}>{t.priority === 'high' ? '! ' : ''}</span>
                                        {t.title}
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                                        {t.due_at && <span className="flex items-center gap-1"><CalendarClock className="size-3" /> {fmt(t.due_at)}</span>}
                                        {t.remind_at && !t.done && <span className="flex items-center gap-1"><Bell className="size-3" /> {fmt(t.remind_at)}</span>}
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(t)}><Pencil className="size-4" /></Button>
                                <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => remove(t)}><Trash2 className="size-4" /></Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {editing && <EditTaskDialog task={editing} onClose={() => setEditing(null)} />}
        </AppLayout>
    );
}

function EditTaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
    const { data, setData, patch, processing } = useForm({
        title: task.title,
        description: task.description ?? '',
        priority: task.priority,
        due_at: toLocalInput(task.due_at),
        remind_at: toLocalInput(task.remind_at),
    });

    useEffect(() => {
        setData({
            title: task.title,
            description: task.description ?? '',
            priority: task.priority,
            due_at: toLocalInput(task.due_at),
            remind_at: toLocalInput(task.remind_at),
        });
    }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

    const submit = (e: FormEvent) => {
        e.preventDefault();
        patch(route('tasks.update', task.id), { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <form onSubmit={submit} className="grid gap-4">
                    <DialogHeader><DialogTitle className="font-mono">Edit task</DialogTitle></DialogHeader>
                    <div className="grid gap-1.5">
                        <Label>Title</Label>
                        <Input value={data.title} onChange={(e) => setData('title', e.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Notes</Label>
                        <Input value={data.description} onChange={(e) => setData('description', e.target.value)} placeholder="Optional" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="grid gap-1.5">
                            <Label>Priority</Label>
                            <Select value={data.priority} onValueChange={(v) => setData('priority', v as Task['priority'])}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Due</Label>
                            <Input type="datetime-local" value={data.due_at} onChange={(e) => setData('due_at', e.target.value)} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Remind</Label>
                            <Input type="datetime-local" value={data.remind_at} onChange={(e) => setData('remind_at', e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={processing}>Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
