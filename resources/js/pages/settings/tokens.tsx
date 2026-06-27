import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Copy, KeyRound, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface Token {
    id: number;
    name: string;
    last_used_at: string | null;
    created_at: string | null;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'API tokens', href: '/settings/tokens' }];

export default function Tokens({ tokens }: { tokens: Token[] }) {
    const page = usePage<{ flash: { token?: string } }>();
    const fresh = page.props.flash?.token ?? null;
    const [copied, setCopied] = useState(false);

    const { data, setData, post, processing, reset, errors } = useForm({ name: '' });

    const create = (e: FormEvent) => {
        e.preventDefault();
        post(route('tokens.store'), { preserveScroll: true, onSuccess: () => reset() });
    };

    const revoke = (id: number) => router.delete(route('tokens.destroy', id), { preserveScroll: true });

    const copy = () => {
        if (fresh) {
            navigator.clipboard.writeText(fresh);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="API tokens" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall title="API tokens" description="Personal access tokens for the REST API and WebDAV." />

                    {fresh && (
                        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
                            <p className="mb-2 text-sm">Your new token — copy it now, it won’t be shown again:</p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 break-all rounded border border-border bg-background/60 p-2 text-xs">{fresh}</code>
                                <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" onClick={copy}>
                                    <Copy className="size-4" />
                                </Button>
                            </div>
                            {copied && <p className="mt-1 text-xs text-primary">Copied.</p>}
                        </div>
                    )}

                    <form onSubmit={create} className="flex items-end gap-2">
                        <div className="grid flex-1 gap-1.5">
                            <Label htmlFor="token-name">Name</Label>
                            <Input id="token-name" value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="e.g. Laptop WebDAV" />
                            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                        </div>
                        <Button type="submit" disabled={processing} className="gap-2">
                            <KeyRound className="size-4" /> Create
                        </Button>
                    </form>

                    <div className="space-y-2">
                        {tokens.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No tokens yet.</p>
                        ) : (
                            tokens.map((t) => (
                                <div key={t.id} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate font-medium">{t.name}</div>
                                        <div className="truncate text-xs text-muted-foreground">
                                            created {t.created_at} · {t.last_used_at ? `last used ${t.last_used_at}` : 'never used'}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 shrink-0 text-destructive hover:text-destructive"
                                        onClick={() => revoke(t.id)}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
                        <p className="mb-1 font-medium text-foreground">Usage</p>
                        <p>REST: <code>Authorization: Bearer &lt;token&gt;</code> → <code>/api/v1/files</code></p>
                        <p>WebDAV: mount <code>/api/webdav</code> with any username and the token as the password.</p>
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
