import { GridPanel } from '@/components/grid-panel';
import { Button } from '@/components/ui/button';
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
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { CheckCircle2, FolderOpen, Loader2, Pencil, Plus, Server, Trash2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface Conn {
    id: number;
    name: string;
    type: 'sftp' | 'ftp' | 's3';
    summary: string;
}

type ConnType = 'sftp' | 'ftp' | 's3';
type Config = Record<string, string | boolean>;

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Connections', href: '/connections' }];

const jsonHeaders = () => ({
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-XSRF-TOKEN': getXsrfToken(),
});

export default function Connections({ connections }: { connections: Conn[] }) {
    const [editing, setEditing] = useState<Conn | null>(null);
    const [creating, setCreating] = useState(false);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Connections" />
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
                <div className="flex shrink-0 items-center justify-between">
                    <h1 className="font-mono text-lg uppercase tracking-widest text-primary glow-text">Remote connections</h1>
                    <Button className="gap-2" onClick={() => setCreating(true)}>
                        <Plus className="size-4" /> New connection
                    </Button>
                </div>

                {connections.length === 0 ? (
                    <GridPanel label="CONNECTIONS">
                        <div className="px-4 py-16 text-center text-sm text-muted-foreground">
                            No remote connections yet. Add an SFTP, FTP or S3 server.
                        </div>
                    </GridPanel>
                ) : (
                    <GridPanel label="CONNECTIONS" className="flex min-h-0 flex-1 flex-col" bodyClassName="min-h-0 flex-1 overflow-auto">
                        {connections.map((c, i) => (
                            <div
                                key={c.id}
                                className={`grid grid-cols-[1fr_5rem_1.3fr_7rem_8rem] items-center gap-2 border-b border-primary/10 px-4 py-2.5 text-xs last:border-0 hover:bg-primary/5 ${
                                    i % 2 === 1 ? 'bg-foreground/[0.02]' : ''
                                }`}
                            >
                                <span className="flex items-center gap-2 truncate">
                                    <Server className="size-4 shrink-0 text-primary" /> {c.name}
                                </span>
                                <span className="uppercase text-muted-foreground">{c.type}</span>
                                <span className="truncate text-muted-foreground">{c.summary}</span>
                                <HealthBadge id={c.id} />
                                <div className="flex justify-end gap-1">
                                    <Button asChild variant="ghost" size="icon" className="size-8" title="Browse">
                                        <Link href={route('files.index', { disk: `conn_${c.id}` })}>
                                            <FolderOpen className="size-4" />
                                        </Link>
                                    </Button>
                                    <Button variant="ghost" size="icon" className="size-8" title="Edit" onClick={() => setEditing(c)}>
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 text-destructive hover:text-destructive"
                                        title="Delete"
                                        onClick={() => router.delete(route('connections.destroy', c.id), { preserveScroll: true })}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </GridPanel>
                )}
            </div>

            {creating && <ConnectionDialog onClose={() => setCreating(false)} />}
            {editing && <ConnectionDialog connection={editing} onClose={() => setEditing(null)} />}
        </AppLayout>
    );
}

function HealthBadge({ id }: { id: number }) {
    const [state, setState] = useState<'checking' | 'online' | 'offline'>('checking');

    const check = useCallback(() => {
        setState('checking');
        fetch(route('connections.health', id), { headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((d) => setState(d.online ? 'online' : 'offline'))
            .catch(() => setState('offline'));
    }, [id]);

    useEffect(() => check(), [check]);

    const dot = state === 'online' ? 'bg-emerald-400' : state === 'offline' ? 'bg-destructive' : 'bg-amber-400 animate-pulse';
    const label = state === 'online' ? 'Online' : state === 'offline' ? 'Offline' : 'Checking';
    const text = state === 'online' ? 'text-emerald-400' : state === 'offline' ? 'text-destructive' : 'text-amber-400';

    return (
        <button
            type="button"
            onClick={check}
            title="Re-check connection"
            className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider ${text} hover:opacity-80`}
        >
            <span className={`size-2 rounded-full ${dot}`} style={{ boxShadow: state === 'online' ? '0 0 6px currentColor' : undefined }} />
            {label}
        </button>
    );
}

function ConnectionDialog({ connection, onClose }: { connection?: Conn; onClose: () => void }) {
    const editingId = connection?.id;
    const [name, setName] = useState(connection?.name ?? '');
    const [type, setType] = useState<ConnType>(connection?.type ?? 'sftp');
    const [config, setConfig] = useState<Config>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [test, setTest] = useState<{ state: 'idle' | 'busy' | 'ok' | 'fail'; msg?: string }>({ state: 'idle' });
    const [saving, setSaving] = useState(false);

    const set = (k: string, v: string | boolean) => setConfig((c) => ({ ...c, [k]: v }));

    const payload = () => ({ name, type, config });

    const runTest = async () => {
        setTest({ state: 'busy' });
        const res = await fetch(route('connections.test'), { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(payload()) });
        const data = await res.json();
        setTest(data.ok ? { state: 'ok' } : { state: 'fail', msg: data.error });
    };

    const save = () => {
        setSaving(true);
        setErrors({});
        const opts = {
            preserveScroll: true,
            onError: (e: Record<string, string>) => setErrors(e),
            onSuccess: onClose,
            onFinish: () => setSaving(false),
        };
        if (editingId) {
            router.put(route('connections.update', editingId), payload(), opts);
        } else {
            router.post(route('connections.store'), payload(), opts);
        }
    };

    const field = (key: string, label: string, opts: { type?: string; placeholder?: string } = {}) => (
        <div className="grid gap-1.5">
            <Label>{label}</Label>
            <Input
                type={opts.type ?? 'text'}
                placeholder={opts.placeholder}
                value={(config[key] as string) ?? ''}
                onChange={(e) => set(key, e.target.value)}
            />
            {errors[`config.${key}`] && <p className="text-xs text-destructive">{errors[`config.${key}`]}</p>}
        </div>
    );

    const toggle = (key: string, label: string) => (
        <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!config[key]} onChange={(e) => set(key, e.target.checked)} className="accent-primary" />
            {label}
        </label>
    );

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="font-mono uppercase tracking-widest">{editingId ? 'Edit' : 'New'} connection</DialogTitle>
                    <DialogDescription>
                        {editingId ? 'Leave secret fields blank to keep them unchanged.' : 'Credentials are encrypted at rest.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label>Name</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} />
                            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Type</Label>
                            <Select value={type} onValueChange={(v) => setType(v as ConnType)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sftp">SFTP</SelectItem>
                                    <SelectItem value="ftp">FTP</SelectItem>
                                    <SelectItem value="s3">S3</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {(type === 'sftp' || type === 'ftp') && (
                        <>
                            <div className="grid grid-cols-[1fr_6rem] gap-3">
                                {field('host', 'Host')}
                                {field('port', 'Port', { type: 'number', placeholder: type === 'sftp' ? '22' : '21' })}
                            </div>
                            {field('username', 'Username')}
                            {field('password', 'Password', { type: 'password' })}
                            {type === 'sftp' && (
                                <>
                                    <div className="grid gap-1.5">
                                        <Label>Private key (optional)</Label>
                                        <textarea
                                            rows={3}
                                            value={(config.privateKey as string) ?? ''}
                                            onChange={(e) => set('privateKey', e.target.value)}
                                            className="rounded border border-primary/25 bg-card/40 p-2 font-mono text-xs outline-none focus:border-primary"
                                            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                                        />
                                    </div>
                                    {field('passphrase', 'Key passphrase (optional)', { type: 'password' })}
                                </>
                            )}
                            {field('root', 'Root path (optional)', { placeholder: '/' })}
                            {type === 'ftp' && toggle('ssl', 'Use FTPS (SSL)')}
                        </>
                    )}

                    {type === 's3' && (
                        <>
                            {field('key', 'Access key')}
                            {field('secret', 'Secret key', { type: 'password' })}
                            <div className="grid grid-cols-2 gap-3">
                                {field('bucket', 'Bucket')}
                                {field('region', 'Region', { placeholder: 'us-east-1' })}
                            </div>
                            {field('endpoint', 'Endpoint (optional)', { placeholder: 'https://minio.example.com' })}
                            {field('root', 'Prefix (optional)')}
                            {toggle('path_style', 'Path-style endpoint (MinIO, etc.)')}
                        </>
                    )}

                    {test.state !== 'idle' && (
                        <div className={`flex items-center gap-2 text-sm ${test.state === 'fail' ? 'text-destructive' : 'text-primary'}`}>
                            {test.state === 'busy' && <Loader2 className="size-4 animate-spin" />}
                            {test.state === 'ok' && <CheckCircle2 className="size-4" />}
                            {test.state === 'fail' && <XCircle className="size-4" />}
                            <span className="break-all">{test.state === 'busy' ? 'Testing…' : test.state === 'ok' ? 'Connection OK' : test.msg}</span>
                        </div>
                    )}
                </div>

                <DialogFooter className="sm:justify-between">
                    <Button variant="outline" onClick={runTest} disabled={test.state === 'busy'}>
                        Test connection
                    </Button>
                    <Button onClick={save} disabled={saving} className="glow-border">
                        {editingId ? 'Save' : 'Add'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
