import { formatBytes } from '@/lib/format';
import { CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Transfer {
    id: number;
    mode: 'move' | 'copy';
    source: string;
    dest: string;
    destination: string;
    status: 'queued' | 'running' | 'done' | 'failed';
    total_bytes: number;
    done_bytes: number;
    total_files: number;
    done_files: number;
    current: string | null;
    error: string | null;
}

const fmtEta = (s: number) => {
    if (!isFinite(s) || s <= 0) return '';
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

// Module-scoped so they survive the tray remounting on Inertia page reloads.
// Reset only on a real browser refresh (which is the correct moment to re-baseline).
const seenDone = new Set<number>();
let trayInitialized = false;

export function TransfersTray() {
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    // id -> { bytes, t } sample for speed computation
    const samples = useRef<Record<number, { bytes: number; t: number; speed: number }>>({});
    const [, force] = useState(0);

    const poll = async () => {
        try {
            const res = await fetch(route('transfers.index'), { headers: { Accept: 'application/json' } });
            const data: Transfer[] = await res.json();
            const now = performance.now();
            // A transfer reached "done" → refresh the current listing so the moved/copied file shows.
            // The first poll after a real page load just records existing done ids (no reload then).
            let justDone = false;
            for (const t of data) {
                if (t.status === 'done') {
                    if (!trayInitialized) {
                        seenDone.add(t.id);
                    } else if (!seenDone.has(t.id)) {
                        seenDone.add(t.id);
                        justDone = true;
                    }
                }
            }
            trayInitialized = true;
            if (justDone) {
                // Let each page refresh its own way (browser = Inertia reload, commander = re-fetch panes).
                window.dispatchEvent(new Event('fm-transfer-done'));
            }
            for (const t of data) {
                const prev = samples.current[t.id];
                if (prev && t.done_bytes > prev.bytes && now > prev.t) {
                    const speed = ((t.done_bytes - prev.bytes) / (now - prev.t)) * 1000;
                    samples.current[t.id] = { bytes: t.done_bytes, t: now, speed };
                } else if (!prev) {
                    samples.current[t.id] = { bytes: t.done_bytes, t: now, speed: 0 };
                }
            }
            setTransfers(data);
        } catch {
            /* ignore */
        }
    };

    useEffect(() => {
        poll();
        const onKick = () => poll();
        window.addEventListener('fm-transfer', onKick);
        return () => window.removeEventListener('fm-transfer', onKick);
    }, []);

    const active = transfers.some((t) => t.status === 'queued' || t.status === 'running');
    useEffect(() => {
        if (!active) return;
        const id = setInterval(poll, 1500);
        return () => clearInterval(id);
    }, [active]);

    const xsrf = () => decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '');

    const dismiss = async (id: number) => {
        await fetch(route('transfers.destroy', id), { method: 'DELETE', headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf() } });
        setTransfers((prev) => prev.filter((t) => t.id !== id));
    };

    const clearDone = async () => {
        await fetch(route('transfers.clear'), {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
                'X-XSRF-TOKEN': decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? ''),
            },
        });
        setTransfers((prev) => prev.filter((t) => t.status === 'queued' || t.status === 'running'));
        force((n) => n + 1);
    };

    if (transfers.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-40 w-80 space-y-2">
            <div className="glow-border flex items-center justify-between rounded border border-primary/40 bg-card/95 px-3 py-1.5 font-mono text-xs uppercase tracking-widest backdrop-blur-sm">
                <span className="text-primary">Transfers</span>
                <button type="button" onClick={clearDone} className="text-foreground/70 transition-colors hover:text-primary">
                    Clear done
                </button>
            </div>
            {transfers.map((t) => {
                const pct = t.total_bytes > 0 ? Math.min(100, Math.round((t.done_bytes / t.total_bytes) * 100)) : t.status === 'done' ? 100 : 0;
                const speed = samples.current[t.id]?.speed ?? 0;
                const eta = speed > 0 ? fmtEta((t.total_bytes - t.done_bytes) / speed) : '';
                return (
                    <div key={t.id} className="glow-border relative overflow-hidden rounded border border-primary/40 bg-card/95 p-2.5 backdrop-blur-sm">
                        <div className="flex items-center gap-2 font-mono text-xs">
                            {t.status === 'running' && <Loader2 className="size-3.5 animate-spin text-primary" />}
                            {t.status === 'queued' && <Loader2 className="size-3.5 text-muted-foreground" />}
                            {t.status === 'done' && <CheckCircle2 className="size-3.5 text-primary" />}
                            {t.status === 'failed' && <XCircle className="size-3.5 text-destructive" />}
                            <span className="flex-1 truncate uppercase">
                                {t.mode} {t.source} → {t.dest}
                            </span>
                            <span className="text-muted-foreground">{pct}%</span>
                            <button type="button" onClick={() => dismiss(t.id)} title="Dismiss" className="text-muted-foreground hover:text-destructive">
                                <X className="size-3.5" />
                            </button>
                        </div>

                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                                className={`h-full rounded-full transition-all ${t.status === 'failed' ? 'bg-destructive' : 'bg-primary'}`}
                                style={{ width: `${pct}%`, boxShadow: t.status === 'failed' ? undefined : '0 0 8px var(--glow)' }}
                            />
                        </div>

                        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                            <span className="truncate">
                                {t.status === 'failed'
                                    ? t.error
                                    : t.current
                                      ? t.current
                                      : `${t.done_files}/${t.total_files} files`}
                            </span>
                            {t.status === 'running' && speed > 0 && (
                                <span className="shrink-0 text-primary">
                                    {formatBytes(speed)}/s{eta ? ` · ${eta}` : ''}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
