import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatBytes } from '@/lib/format';
import { type SharedData } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Ban, Clock, Download, FileLock2, KeyRound } from 'lucide-react';

interface PublicShareProps {
    state: 'ready' | 'locked' | 'expired' | 'gone';
    token?: string;
    name?: string;
    size?: number;
    mime?: string;
    downloadUrl?: string;
    previewUrl?: string;
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
            <div className="scanlines glow-border w-full max-w-md rounded-2xl border border-border bg-card/60 p-8 text-center">
                {children}
            </div>
        </div>
    );
}

export default function PublicShare(props: PublicShareProps) {
    const { state, token, name, size, mime, downloadUrl, previewUrl } = props;
    const { flash } = usePage<SharedData>().props;
    const { data, setData, post, processing } = useForm({ password: '' });

    if (state === 'expired' || state === 'gone') {
        return (
            <Shell>
                <Head title="Link unavailable" />
                <Ban className="mx-auto size-12 text-destructive" />
                <h1 className="mt-4 font-mono text-lg uppercase tracking-widest">
                    {state === 'expired' ? 'Link expired' : 'File unavailable'}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    {state === 'expired' ? 'This share link is no longer valid.' : 'The shared file no longer exists.'}
                </p>
            </Shell>
        );
    }

    if (state === 'locked') {
        return (
            <Shell>
                <Head title="Protected file" />
                <KeyRound className="mx-auto size-12 text-primary glow-text" />
                <h1 className="mt-4 font-mono text-lg uppercase tracking-widest">Password required</h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">{name}</p>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        post(route('share.unlock', token!));
                    }}
                    className="mt-6 grid gap-3 text-left"
                >
                    <Label htmlFor="pw">Password</Label>
                    <Input
                        id="pw"
                        type="password"
                        autoFocus
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                    />
                    {flash?.error && <p className="text-sm text-destructive">{flash.error}</p>}
                    <Button type="submit" disabled={processing} className="glow-border">
                        Unlock
                    </Button>
                </form>
            </Shell>
        );
    }

    const isImage = mime?.startsWith('image/');
    const isPdf = mime === 'application/pdf';

    return (
        <Shell>
            <Head title={name ?? 'Shared file'} />
            <FileLock2 className="mx-auto size-10 text-primary glow-text" />
            <h1 className="mt-3 truncate font-mono text-base">{name}</h1>
            <p className="text-xs text-muted-foreground">{formatBytes(size ?? null)}</p>

            {(isImage || isPdf) && previewUrl && (
                <div className="mt-4 overflow-hidden rounded-lg border border-border bg-background/60">
                    {isImage ? (
                        <img src={previewUrl} alt={name} className="max-h-72 w-full object-contain" />
                    ) : (
                        <iframe src={previewUrl} title={name} className="h-72 w-full" />
                    )}
                </div>
            )}

            <Button asChild className="glow-border mt-6 w-full gap-2">
                <a href={downloadUrl}>
                    <Download className="size-4" />
                    Download
                </a>
            </Button>

            <p className="mt-4 flex items-center justify-center gap-1 font-mono text-[11px] text-muted-foreground">
                <Clock className="size-3" /> shared via FileManager
            </p>
        </Shell>
    );
}
