import { useCyberActive, useCyberPref } from '@/hooks/use-cyber';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

/**
 * Fires a short RGB-split / scan-tear glitch on every Inertia page visit —
 * the "jumping between terminals" feel. Gated by the theme and the glitch pref.
 */
export function GlitchOverlay() {
    const active = useCyberActive();
    const [glitch] = useCyberPref('glitch');
    const [on, setOn] = useState(false);

    useEffect(() => {
        if (!active || !glitch) return;
        let timer = 0;
        const offStart = router.on('start', () => {
            setOn(true);
            window.dispatchEvent(new Event('cyber-transition')); // sound hook (step 5)
        });
        const offFinish = router.on('finish', () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => setOn(false), 250);
        });
        return () => {
            offStart();
            offFinish();
            window.clearTimeout(timer);
        };
    }, [active, glitch]);

    if (!active || !glitch || !on) return null;

    return (
        <div className="cyber-transition pointer-events-none fixed inset-0 z-[150]" aria-hidden>
            <div className="cyber-transition-tear absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,color-mix(in_oklch,var(--primary)_10%,transparent)_3px)]" />
            <div
                className="absolute inset-0 mix-blend-screen"
                style={{ background: 'linear-gradient(90deg, oklch(0.62 0.27 18 / 0.07), transparent 18%, transparent 82%, oklch(0.8 0.15 200 / 0.07))' }}
            />
            <div className="absolute inset-x-0 top-1/2 h-px bg-primary/70 shadow-[0_0_10px_var(--glow)]" />
        </div>
    );
}
