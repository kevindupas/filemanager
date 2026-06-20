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
}

interface UsersProps {
    users: AdminUser[];
    roles: string[];
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Users', href: '/admin/users' }];

export default function Users({ users, roles }: UsersProps) {
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

            <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} roles={roles} />
            <EditUserDialog target={editTarget} roles={roles} onClose={() => setEditTarget(null)} />
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
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    roles: string[];
}) {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        role: 'user',
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
    onClose,
}: {
    target: AdminUser | null;
    roles: string[];
    onClose: () => void;
}) {
    const { data, setData, put, processing, errors } = useForm({
        name: '',
        email: '',
        password: '',
        role: 'user',
    });

    useEffect(() => {
        if (target) {
            setData({ name: target.name, email: target.email, password: '', role: target.role ?? 'user' });
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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            {children}
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
