import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getXsrfToken } from '@/lib/csrf';
import { type FileEntry } from '@/types';
import { Check, Copy, KeyRound, Link2, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Share {
    id: number;
    url: string;
    has_password: boolean;
    expires_at: string | null;
    expired: boolean;
    downloads: number;
}

const jsonHeaders = () => ({
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-XSRF-TOKEN': getXsrfToken(),
});

export function ShareDialog({ target, onClose }: { target: FileEntry | null; onClose: () => void }) {
    const [shares, setShares] = useState<Share[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [expiry, setExpiry] = useState('0'); // days, 0 = never
    const [password, setPassword] = useState('');
    const [copied, setCopied] = useState<number | null>(null);

    useEffect(() => {
        setShares([]);
        setExpiry('0');
        setPassword('');
        if (!target) return;
        setLoading(true);
        fetch(route('shares.for', { path: target.path }), { headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then(setShares)
            .finally(() => setLoading(false));
    }, [target]);

    const create = async () => {
        if (!target) return;
        setCreating(true);
        const res = await fetch(route('shares.store'), {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({
                path: target.path,
                expires_in_days: expiry === '0' ? null : Number(expiry),
                password: password || null,
            }),
        });
        setCreating(false);
        if (res.ok) {
            const share = await res.json();
            setShares((prev) => [share, ...prev]);
            setPassword('');
        }
    };

    const revoke = async (id: number) => {
        await fetch(route('shares.destroy', id), { method: 'DELETE', headers: jsonHeaders() });
        setShares((prev) => prev.filter((s) => s.id !== id));
    };

    const copy = (share: Share) => {
        navigator.clipboard.writeText(share.url);
        setCopied(share.id);
        setTimeout(() => setCopied(null), 1500);
    };

    return (
        <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="truncate pr-8 font-mono">Share “{target?.name}”</DialogTitle>
                    <DialogDescription>Create a public link. Anyone with it can download the file.</DialogDescription>
                </DialogHeader>

                {/* Create form */}
                <div className="grid gap-3 rounded-lg border border-border p-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label>Expires</Label>
                            <Select value={expiry} onValueChange={setExpiry}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Never</SelectItem>
                                    <SelectItem value="1">1 day</SelectItem>
                                    <SelectItem value="7">7 days</SelectItem>
                                    <SelectItem value="30">30 days</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Password (optional)</Label>
                            <Input
                                type="text"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="None"
                            />
                        </div>
                    </div>
                    <Button onClick={create} disabled={creating} className="glow-border gap-2">
                        {creating ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                        Create link
                    </Button>
                </div>

                {/* Existing shares */}
                <div className="space-y-2">
                    {loading ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="size-5 animate-spin text-primary" />
                        </div>
                    ) : shares.length === 0 ? (
                        <p className="py-2 text-center text-sm text-muted-foreground">No links yet.</p>
                    ) : (
                        shares.map((s) => (
                            <div key={s.id} className="rounded-md border border-border p-2">
                                <div className="flex items-center gap-2">
                                    <Input readOnly value={s.url} className="h-8 text-xs" />
                                    <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => copy(s)}>
                                        {copied === s.id ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 shrink-0 text-destructive hover:text-destructive"
                                        onClick={() => revoke(s.id)}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
                                    {s.has_password && (
                                        <span className="flex items-center gap-1">
                                            <KeyRound className="size-3" /> password
                                        </span>
                                    )}
                                    <span>{s.expired ? 'expired' : s.expires_at ? `expires ${s.expires_at}` : 'never expires'}</span>
                                    <span>{s.downloads} downloads</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
