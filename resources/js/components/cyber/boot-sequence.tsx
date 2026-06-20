import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

// Set by the login page; makes the boot sequence play once right after sign-in
// (in every theme — the bar/text use the active theme's --primary/--glow).
const PENDING_KEY = 'boot.pending';

type Line = { text: string; tone?: 'dim' | 'cyan' | 'ok' | 'warn' };

function buildLines(name: string): Line[] {
    return [
        { text: 'RABBITHOLE OS  v2.0.77   ·   MILITECH SECURE TERMINAL', tone: 'cyan' },
        { text: '' },
        { text: '> POWER-ON SELF TEST ................... OK', tone: 'ok' },
        { text: '> ESTABLISHING NETRUNNER LINK .......... OK', tone: 'ok' },
        { text: '> DECRYPTING ICE LAYER [AES-256-GCM] ... OK', tone: 'ok' },
        { text: `> AUTHENTICATING OPERATOR: ${name.toUpperCase()}`, tone: 'warn' },
        { text: '> MOUNTING FILESYSTEMS [local] ......... OK', tone: 'ok' },
        { text: '> SYNCING REMOTE DISKS ................. OK', tone: 'ok' },
        { text: '> LOADING HUD MODULES .................. OK', tone: 'ok' },
        { text: '> BREACH PROTOCOL ..................... READY', tone: 'warn' },
        { text: '' },
        { text: 'WAKE THE F*CK UP, NETRUNNER.', tone: 'cyan' },
    ];
}

const TONE_CLASS: Record<NonNullable<Line['tone']>, string> = {
    dim: 'text-muted-foreground',
    cyan: 'text-[oklch(0.8_0.15_200)]',
    ok: 'text-primary',
    warn: 'text-[oklch(0.62_0.27_18)]',
};

export function BootSequence() {
    const { auth } = usePage<SharedData>().props;
    const name = auth?.user?.name ?? 'OPERATOR';

    // Initialise synchronously from the pending flag so the overlay is painted in
    // the SAME frame as the page — the dashboard never flashes underneath first.
    const [running, setRunning] = useState(() => typeof window !== 'undefined' && sessionStorage.getItem(PENDING_KEY) === '1');
    const [closing, setClosing] = useState(false);
    const [step, setStep] = useState(0);
    const [progress, setProgress] = useState(0);
    const lines = useRef<Line[]>(buildLines(name));

    const finish = useCallback(() => {
        setClosing(true);
        window.setTimeout(() => {
            setRunning(false);
            setClosing(false);
        }, 450);
    }, []);

    const start = useCallback(() => {
        lines.current = buildLines(name);
        setStep(0);
        setProgress(0);
        setClosing(false);
        setRunning(true);
        window.dispatchEvent(new Event('cyber-boot-start')); // sound hook
    }, [name]);

    // Already running from the login flag → clear it + kick the boot sound once.
    // Also replay on REBOOT. Theme-agnostic.
    useEffect(() => {
        if (running) {
            sessionStorage.removeItem(PENDING_KEY);
            window.dispatchEvent(new Event('cyber-boot-start'));
        }
        const onReboot = () => start();
        window.addEventListener('cyber-reboot', onReboot);
        return () => window.removeEventListener('cyber-reboot', onReboot);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reveal lines + fill the progress bar while running.
    useEffect(() => {
        if (!running) return;
        const total = lines.current.length;
        const perLine = 230;
        const timers = lines.current.map((_, i) => window.setTimeout(() => setStep(i + 1), perLine * i + 250));
        const prog = window.setInterval(() => setProgress((p) => Math.min(100, p + 3)), 45);
        const end = window.setTimeout(finish, perLine * total + 1100);
        return () => {
            timers.forEach(clearTimeout);
            clearInterval(prog);
            clearTimeout(end);
        };
    }, [running, finish]);

    // Skip on any key / click.
    useEffect(() => {
        if (!running) return;
        const skip = () => finish();
        window.addEventListener('keydown', skip);
        window.addEventListener('pointerdown', skip);
        return () => {
            window.removeEventListener('keydown', skip);
            window.removeEventListener('pointerdown', skip);
        };
    }, [running, finish]);

    if (!running) return null;

    const shown = lines.current.slice(0, step);

    return (
        <div
            className={`fixed inset-0 z-[200] flex items-center justify-center bg-black font-mono ${closing ? 'cyber-boot-out' : 'cyber-boot-in'}`}
            aria-hidden
        >
            {/* scanlines + vignette */}
            <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.35)_3px,rgba(0,0,0,0.35)_4px)]" />
            <div className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_center,transparent_55%,rgba(0,0,0,0.85))]" />

            <div className="relative w-full max-w-2xl px-8">
                <pre className="cyber-glitch-text mb-6 text-lg font-bold leading-tight text-primary sm:text-2xl" data-text="RABBITHOLE//OS">
                    {String.raw`  ___  ___   _   ___ ___ ___ ___
 | _ \/ _ \ | | | _ ) _ )_ _| __|
 |   / (_) || | | _ \ _ \| || _|
 |_|_\\___/ |_| |___/___/___|___|`}
                </pre>

                <div className="min-h-[15rem] space-y-0.5 text-xs sm:text-sm">
                    {shown.map((l, i) => (
                        <div key={i} className={`${l.tone ? TONE_CLASS[l.tone] : 'text-foreground/80'} ${i === shown.length - 1 ? 'cyber-type-line' : ''}`}>
                            {l.text || ' '}
                            {i === shown.length - 1 && step < lines.current.length && <span className="cyber-caret">▊</span>}
                        </div>
                    ))}
                </div>

                {/* segmented progress bar */}
                <div className="mt-6 flex items-center gap-3">
                    <div className="flex h-3 flex-1 gap-[2px] overflow-hidden rounded-[2px] border border-primary/40 p-[2px]">
                        {Array.from({ length: 40 }).map((_, i) => (
                            <div key={i} className="h-full flex-1" style={{ background: i < (progress / 100) * 40 ? 'var(--primary)' : 'transparent', boxShadow: i < (progress / 100) * 40 ? '0 0 6px var(--glow)' : undefined }} />
                        ))}
                    </div>
                    <span className="w-12 text-right text-sm text-primary">{Math.round(progress)}%</span>
                </div>

                <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-muted-foreground">[ press any key to skip ]</p>
            </div>
        </div>
    );
}
