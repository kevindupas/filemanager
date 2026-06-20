import { readCyberPref, useCyberActive } from '@/hooks/use-cyber';
import { playAction, playBoot, playTransition, unlockAudio } from '@/lib/cyber-sound';
import { useEffect } from 'react';
import { BootSequence } from './boot-sequence';
import { GlitchOverlay } from './glitch-overlay';

/**
 * Mounts the Cyberpunk 2077 experience layer. Every piece self-gates on the
 * active theme, so this renders nothing (and costs nothing) under other themes.
 */
export function CyberExperience() {
    const active = useCyberActive();

    // Procedural SFX, played on experience events when the sound pref is on.
    useEffect(() => {
        if (!active) return;
        const unlock = () => unlockAudio();
        window.addEventListener('pointerdown', unlock);
        window.addEventListener('keydown', unlock);

        const guard = (fn: () => void) => () => {
            if (readCyberPref('sound')) fn();
        };
        const onBoot = guard(playBoot);
        const onTransition = guard(playTransition);
        const onAction = guard(playAction);
        window.addEventListener('cyber-boot-start', onBoot);
        window.addEventListener('cyber-transition', onTransition);
        window.addEventListener('fm-transfer-done', onAction);

        return () => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
            window.removeEventListener('cyber-boot-start', onBoot);
            window.removeEventListener('cyber-transition', onTransition);
            window.removeEventListener('fm-transfer-done', onAction);
        };
    }, [active]);

    return (
        <>
            <BootSequence />
            <GlitchOverlay />
            {active && <div className="cyber-ambient" aria-hidden />}
        </>
    );
}
