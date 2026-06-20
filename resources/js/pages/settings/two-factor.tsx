import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Two-factor authentication', href: '/settings/two-factor' }];

const jsonGet = (url: string) => fetch(url, { headers: { Accept: 'application/json' } }).then((r) => r.json());

export default function TwoFactor({ enabled, confirmed }: { enabled: boolean; confirmed: boolean }) {
    const [qr, setQr] = useState<string | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [codes, setCodes] = useState<string[] | null>(null);
    const [confirmCode, setConfirmCode] = useState('');
    const [error, setError] = useState<string | null>(null);

    // While enabled-but-not-confirmed: show QR + secret to scan.
    useEffect(() => {
        if (enabled && !confirmed) {
            jsonGet(route('two-factor.qr-code')).then((d) => setQr(d.svg));
            jsonGet(route('two-factor.secret-key')).then((d) => setSecret(d.secretKey));
        }
    }, [enabled, confirmed]);

    // Once confirmed: load recovery codes.
    useEffect(() => {
        if (confirmed) jsonGet(route('two-factor.recovery-codes')).then(setCodes);
    }, [confirmed]);

    const enable = () => router.post(route('two-factor.enable'), {}, { preserveScroll: true });
    const disable = () => router.delete(route('two-factor.disable'), { preserveScroll: true });
    const regenerate = () =>
        router.post(route('two-factor.regenerate-recovery-codes'), {}, {
            preserveScroll: true,
            onSuccess: () => jsonGet(route('two-factor.recovery-codes')).then(setCodes),
        });

    const confirm = () => {
        setError(null);
        router.post(
            route('two-factor.confirm'),
            { code: confirmCode },
            { preserveScroll: true, onError: () => setError('Invalid code. Try again.'), onSuccess: () => setConfirmCode('') },
        );
    };

    const RecoveryCodes = () =>
        codes ? (
            <div className="grid gap-2">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Recovery codes</p>
                <div className="grid grid-cols-2 gap-1 rounded border border-primary/20 bg-card/40 p-3 font-mono text-sm">
                    {codes.map((c) => (
                        <span key={c}>{c}</span>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">Store these somewhere safe — each can be used once if you lose your device.</p>
                <Button variant="outline" size="sm" onClick={regenerate} className="w-fit">
                    Regenerate codes
                </Button>
            </div>
        ) : null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Two-factor authentication" />
            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall title="Two-factor authentication" description="Add an extra layer of security to your account" />

                    {!enabled && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Protect your account with a one-time code from an authenticator app (Google Authenticator, 1Password, …).
                            </p>
                            <Button onClick={enable} className="gap-2">
                                <ShieldCheck className="size-4" /> Enable 2FA
                            </Button>
                        </div>
                    )}

                    {enabled && !confirmed && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">Scan this QR code with your authenticator app, then enter the generated code.</p>
                            {qr && <div className="w-fit rounded border border-primary/20 bg-white p-3" dangerouslySetInnerHTML={{ __html: qr }} />}
                            {secret && (
                                <p className="font-mono text-xs text-muted-foreground">
                                    Setup key: <span className="text-foreground">{secret}</span>
                                </p>
                            )}
                            <div className="grid max-w-xs gap-2">
                                <Label htmlFor="confirm-code">Code</Label>
                                <Input id="confirm-code" inputMode="numeric" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} />
                                {error && <p className="text-sm text-destructive">{error}</p>}
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={confirm} disabled={!confirmCode}>
                                    Confirm
                                </Button>
                                <Button variant="outline" onClick={disable}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    {confirmed && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-2 rounded border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
                                <CheckCircle2 className="size-4 text-primary" />
                                Two-factor authentication is <span className="font-semibold">enabled</span>.
                            </div>
                            <RecoveryCodes />
                            <Button variant="destructive" onClick={disable} className="w-fit">
                                Disable 2FA
                            </Button>
                        </div>
                    )}
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
