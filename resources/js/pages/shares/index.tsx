import { GridPanel } from '@/components/grid-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getXsrfToken } from '@/lib/csrf';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Check, Copy, KeyRound, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface Share {
    id: number;
    name: string;
    path: string;
    url: string;
    has_password: boolean;
    expires_at: string | null;
    expired: boolean;
    downloads: number;
    last_accessed_at: string | null;
    created_by: string | null;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Shares', href: '/shares' }];

export default function Shares({ shares }: { shares: Share[] }) {
    const [copied, setCopied] = useState<number | null>(null);

    const copy = (s: Share) => {
        navigator.clipboard.writeText(s.url);
        setCopied(s.id);
        setTimeout(() => setCopied(null), 1500);
    };

    const revoke = async (id: number) => {
        await fetch(route('shares.destroy', id), {
            method: 'DELETE',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': getXsrfToken() },
        });
        router.reload({ only: ['shares'] });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Shares" />

            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
                <h1 className="shrink-0 font-mono text-lg uppercase tracking-widest text-primary glow-text">Public links</h1>

                <GridPanel label="PUBLIC LINKS" className="flex min-h-0 flex-1 flex-col" bodyClassName="min-h-0 flex-1 overflow-auto">
                    <div className="min-w-[48rem]">
                        <div className="sticky top-0 z-10 grid grid-cols-[1fr_1.4fr_7rem_5rem_3rem] items-center gap-2 border-b border-primary/20 bg-card/95 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-foreground/40 backdrop-blur-sm">
                            <span>File</span>
                            <span>Link</span>
                            <span>Expires</span>
                            <span className="text-right">DLs</span>
                            <span></span>
                        </div>
                        {shares.length === 0 ? (
                            <div className="px-4 py-16 text-center text-sm text-muted-foreground">No share links yet.</div>
                        ) : (
                            shares.map((s, i) => (
                                <div
                                    key={s.id}
                                    className={`grid grid-cols-[1fr_1.4fr_7rem_5rem_3rem] items-center gap-2 border-b border-primary/10 px-4 py-2.5 text-xs transition-colors last:border-0 hover:bg-primary/5 ${
                                        i % 2 === 1 ? 'bg-foreground/[0.02]' : ''
                                    }`}
                                >
                                    <div className="flex min-w-0 items-center gap-2">
                                        {s.has_password && <KeyRound className="size-3.5 shrink-0 text-primary" />}
                                        <span className="truncate">{s.path}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Input readOnly value={s.url} className="h-7 text-xs" />
                                        <Button variant="outline" size="icon" className="size-7 shrink-0" onClick={() => copy(s)}>
                                            {copied === s.id ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
                                        </Button>
                                    </div>
                                    <span className={`text-xs ${s.expired ? 'text-destructive' : 'text-muted-foreground'}`}>
                                        {s.expired ? 'expired' : s.expires_at ? s.expires_at.split(' ')[0] : 'never'}
                                    </span>
                                    <span className="text-right text-muted-foreground">{s.downloads}</span>
                                    <div className="flex justify-end">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-8 text-destructive hover:text-destructive"
                                            onClick={() => revoke(s.id)}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </GridPanel>
            </div>
        </AppLayout>
    );
}
