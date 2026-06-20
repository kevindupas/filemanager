import { useCyberActive } from '@/hooks/use-cyber';
import { BootSequence } from './boot-sequence';
import { GlitchOverlay } from './glitch-overlay';

/**
 * Mounts the Cyberpunk 2077 experience layer. Every piece self-gates on the
 * active theme, so this renders nothing (and costs nothing) under other themes.
 */
export function CyberExperience() {
    const active = useCyberActive();

    return (
        <>
            <BootSequence />
            <GlitchOverlay />
            {active && <div className="cyber-ambient" aria-hidden />}
        </>
    );
}
