import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Head, useForm } from '@inertiajs/react';
import { Check, X } from 'lucide-react';
import { FormEvent } from 'react';

interface SystemCheck {
    name: string;
    ok: boolean;
    value: string;
    critical: boolean;
}

interface InstallProps {
    checks: SystemCheck[];
    defaultQuotaGb: number;
}

export default function Install({ checks, defaultQuotaGb }: InstallProps) {
    const blocked = checks.some((c) => c.critical && !c.ok);

    const { data, setData, post, processing, errors } = useForm({
        app_name: 'FileManager',
        admin_name: '',
        admin_email: '',
        password: '',
        password_confirmation: '',
        default_quota_gb: String(defaultQuotaGb),
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/install');
    };

    return (
        <div className="flex min-h-svh items-center justify-center bg-background p-4">
            <Head title="Install" />

            <div className="w-full max-w-lg space-y-6 rounded-md border border-primary/30 bg-card p-6">
                <div>
                    <h1 className="text-xl font-semibold">Welcome — let's set up your instance</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        This one-time wizard creates your admin account. It locks itself afterwards.
                    </p>
                </div>

                {/* System checks */}
                <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">System check</p>
                    {checks.map((c) => (
                        <div key={c.name} className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm">
                            <span className="flex items-center gap-2">
                                {c.ok ? (
                                    <Check className="size-4 text-emerald-500" />
                                ) : (
                                    <X className={c.critical ? 'size-4 text-destructive' : 'size-4 text-amber-500'} />
                                )}
                                {c.name}
                            </span>
                            <span className="text-xs text-muted-foreground">{c.value}</span>
                        </div>
                    ))}
                    {blocked && (
                        <p className="text-sm text-destructive">
                            Fix the failing checks above (database, storage permissions) then reload.
                        </p>
                    )}
                </div>

                <form onSubmit={submit} className="space-y-4">
                    <Field label="Instance name" error={errors.app_name}>
                        <Input value={data.app_name} onChange={(e) => setData('app_name', e.target.value)} />
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Admin name" error={errors.admin_name}>
                            <Input value={data.admin_name} onChange={(e) => setData('admin_name', e.target.value)} autoFocus />
                        </Field>
                        <Field label="Admin email" error={errors.admin_email}>
                            <Input type="email" value={data.admin_email} onChange={(e) => setData('admin_email', e.target.value)} />
                        </Field>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Password" error={errors.password}>
                            <Input type="password" value={data.password} onChange={(e) => setData('password', e.target.value)} />
                        </Field>
                        <Field label="Confirm password" error={errors.password_confirmation}>
                            <Input
                                type="password"
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                            />
                        </Field>
                    </div>

                    <Field label="Default quota per user (GB)" error={errors.default_quota_gb}>
                        <Input
                            type="number"
                            min={0}
                            step="any"
                            value={data.default_quota_gb}
                            onChange={(e) => setData('default_quota_gb', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Use 0 for unlimited. Each account can be overridden later.</p>
                    </Field>

                    <Button type="submit" className="w-full" disabled={processing || blocked}>
                        Create admin & finish
                    </Button>
                </form>
            </div>
        </div>
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
