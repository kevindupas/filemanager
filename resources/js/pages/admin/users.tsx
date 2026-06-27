import { DataTable } from '@/components/thegridcn/data-table';
import { Badge } from '@/components/ui/badge';
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
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';

interface AdminUser extends Record<string, unknown> {
    id: number;
    name: string;
    email: string;
    role: string | null;
    created_at: string | null;
    quota_bytes: number | null;
}

interface UsersProps {
    users: AdminUser[];
    roles: string[];
    defaultQuotaBytes: number;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Users', href: '/admin/users' }];

const GIB = 1024 ** 3;

/** bytes → GB string for a form field. null = '' (inherit), 0 = '0' (unlimited). */
function quotaToGbField(bytes: number | null): string {
    if (bytes === null) return '';
    if (bytes === 0) return '0';
    return String(Math.round((bytes / GIB) * 100) / 100);
}

function quotaLabel(bytes: number | null, defaultBytes: number): string {
    if (bytes === null) return `Default (${Math.round((defaultBytes / GIB) * 100) / 100} GB)`;
    if (bytes === 0) return 'Unlimited';
    return `${Math.round((bytes / GIB) * 100) / 100} GB`;
}

export default function Users({ users, roles, defaultQuotaBytes }: UsersProps) {
    const [createOpen, setCreateOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Users" />

            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
                <div className="flex shrink-0 items-center justify-between">
                    <h1 className="font-mono text-lg uppercase tracking-widest text-primary glow-text">Accounts</h1>
                    <Button className="glow-border gap-2" onClick={() => setCreateOpen(true)}>
                        <UserPlus className="size-4" />
                        New user
                    </Button>
                </div>

                <DataTable
                    className="flex min-h-0 flex-1 flex-col"
                    label="ACCOUNTS"
                    data={users}
                    columns={[
                        { key: 'name', label: 'Name', sortable: true },
                        { key: 'email', label: 'Email', sortable: true },
                        {
                            key: 'role',
                            label: 'Role',
                            render: (v) => (
                                <Badge variant={v === 'admin' ? 'default' : 'secondary'} className="uppercase">
                                    {String(v ?? '—')}
                                </Badge>
                            ),
                        },
                        {
                            key: 'quota_bytes',
                            label: 'Quota',
                            render: (_v, user) => (
                                <span className="text-muted-foreground">{quotaLabel(user.quota_bytes, defaultQuotaBytes)}</span>
                            ),
                        },
                        { key: 'created_at', label: 'Created', sortable: true },
                        {
                            key: 'id',
                            label: '',
                            align: 'right',
                            render: (_v, user) => (
                                <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditTarget(user)}>
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 text-destructive hover:text-destructive"
                                        onClick={() => setDeleteTarget(user)}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            ),
                        },
                    ]}
                />
            </div>

            <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} roles={roles} defaultQuotaBytes={defaultQuotaBytes} />
            <EditUserDialog target={editTarget} roles={roles} defaultQuotaBytes={defaultQuotaBytes} onClose={() => setEditTarget(null)} />
            <DeleteUserDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
        </AppLayout>
    );
}

function RoleSelect({ value, onChange, roles }: { value: string; onChange: (v: string) => void; roles: string[] }) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
                <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
                {roles.map((role) => (
                    <SelectItem key={role} value={role} className="uppercase">
                        {role}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function CreateUserDialog({
    open,
    onOpenChange,
    roles,
    defaultQuotaBytes,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    roles: string[];
    defaultQuotaBytes: number;
}) {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        role: 'user',
        quota_gb: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('admin.users.store'), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onOpenChange(false);
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={submit} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle className="font-mono uppercase tracking-widest">New user</DialogTitle>
                        <DialogDescription>Create an account and assign a role.</DialogDescription>
                    </DialogHeader>
                    <Field label="Name" error={errors.name}>
                        <Input value={data.name} onChange={(e) => setData('name', e.target.value)} autoFocus />
                    </Field>
                    <Field label="Email" error={errors.email}>
                        <Input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} />
                    </Field>
                    <Field label="Password" error={errors.password}>
                        <Input type="password" value={data.password} onChange={(e) => setData('password', e.target.value)} />
                    </Field>
                    <Field label="Role" error={errors.role}>
                        <RoleSelect value={data.role} onChange={(v) => setData('role', v)} roles={roles} />
                    </Field>
                    <QuotaField
                        value={data.quota_gb}
                        onChange={(v) => setData('quota_gb', v)}
                        error={errors.quota_gb}
                        defaultQuotaBytes={defaultQuotaBytes}
                    />
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

function EditUserDialog({
    target,
    roles,
    defaultQuotaBytes,
    onClose,
}: {
    target: AdminUser | null;
    roles: string[];
    defaultQuotaBytes: number;
    onClose: () => void;
}) {
    const { data, setData, put, processing, errors } = useForm({
        name: '',
        email: '',
        password: '',
        role: 'user',
        quota_gb: '',
    });

    useEffect(() => {
        if (target) {
            setData({
                name: target.name,
                email: target.email,
                password: '',
                role: target.role ?? 'user',
                quota_gb: quotaToGbField(target.quota_bytes),
            });
        }
    }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (!target) return;
        put(route('admin.users.update', target.id), {
            preserveScroll: true,
            onSuccess: onClose,
        });
    };

    return (
        <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <form onSubmit={submit} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle className="font-mono uppercase tracking-widest">Edit user</DialogTitle>
                        <DialogDescription>Leave the password blank to keep it unchanged.</DialogDescription>
                    </DialogHeader>
                    <Field label="Name" error={errors.name}>
                        <Input value={data.name} onChange={(e) => setData('name', e.target.value)} />
                    </Field>
                    <Field label="Email" error={errors.email}>
                        <Input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} />
                    </Field>
                    <Field label="New password" error={errors.password}>
                        <Input type="password" value={data.password} onChange={(e) => setData('password', e.target.value)} />
                    </Field>
                    <Field label="Role" error={errors.role}>
                        <RoleSelect value={data.role} onChange={(v) => setData('role', v)} roles={roles} />
                    </Field>
                    <QuotaField
                        value={data.quota_gb}
                        onChange={(v) => setData('quota_gb', v)}
                        error={errors.quota_gb}
                        defaultQuotaBytes={defaultQuotaBytes}
                    />
                    <DialogFooter>
                        <Button type="submit" disabled={processing} className="glow-border">
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DeleteUserDialog({ target, onClose }: { target: AdminUser | null; onClose: () => void }) {
    const [processing, setProcessing] = useState(false);

    const confirm = () => {
        if (!target) return;
        setProcessing(true);
        router.delete(route('admin.users.destroy', target.id), {
            preserveScroll: true,
            onFinish: () => {
                setProcessing(false);
                onClose();
            },
        });
    };

    return (
        <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="font-mono uppercase tracking-widest">Delete user</DialogTitle>
                    <DialogDescription>
                        Delete <span className="font-semibold text-foreground">{target?.name}</span>? This cannot be undone.
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

function QuotaField({
    value,
    onChange,
    error,
    defaultQuotaBytes,
}: {
    value: string;
    onChange: (v: string) => void;
    error?: string;
    defaultQuotaBytes: number;
}) {
    const defaultGb = Math.round((defaultQuotaBytes / GIB) * 100) / 100;

    return (
        <Field label="Quota (GB)" error={error}>
            <Input
                type="number"
                min={0}
                step="any"
                placeholder={`Default (${defaultGb} GB)`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Leave empty to inherit the default. Use 0 for unlimited.</p>
        </Field>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            {children}
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
