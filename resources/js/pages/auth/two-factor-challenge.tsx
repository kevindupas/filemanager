import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

export default function TwoFactorChallenge() {
    const [recovery, setRecovery] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({ code: '', recovery_code: '' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/two-factor-challenge', { onError: () => reset('code', 'recovery_code') });
    };

    return (
        <AuthLayout
            title="Two-factor authentication"
            description={recovery ? 'Enter one of your recovery codes.' : 'Enter the code from your authenticator app.'}
        >
            <Head title="Two-factor challenge" />
            <form onSubmit={submit} className="flex flex-col gap-5">
                {recovery ? (
                    <div className="grid gap-2">
                        <Label htmlFor="recovery_code">Recovery code</Label>
                        <Input
                            id="recovery_code"
                            autoFocus
                            autoComplete="one-time-code"
                            value={data.recovery_code}
                            onChange={(e) => setData('recovery_code', e.target.value)}
                        />
                        {errors.recovery_code && <p className="text-sm text-destructive">{errors.recovery_code}</p>}
                    </div>
                ) : (
                    <div className="grid gap-2">
                        <Label htmlFor="code">Authentication code</Label>
                        <Input
                            id="code"
                            autoFocus
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={data.code}
                            onChange={(e) => setData('code', e.target.value)}
                        />
                        {errors.code && <p className="text-sm text-destructive">{errors.code}</p>}
                    </div>
                )}

                <Button type="submit" disabled={processing} className="w-full">
                    Verify
                </Button>

                <button
                    type="button"
                    onClick={() => setRecovery((r) => !r)}
                    className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                    {recovery ? 'Use an authentication code' : 'Use a recovery code'}
                </button>
            </form>
        </AuthLayout>
    );
}
