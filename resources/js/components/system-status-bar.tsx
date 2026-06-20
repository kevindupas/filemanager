import { DecodeText } from '@/components/cyber/decode-text';
import { StatusBar } from '@/components/thegridcn/status-bar';
import { useCyberActive, useCyberPref } from '@/hooks/use-cyber';
import { GRID_THEME_LABELS, useGridTheme } from '@/hooks/use-grid-theme';
import { Power, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Thin retro HUD status bar across the top of the working area. */
export function SystemStatusBar() {
    const { theme } = useGridTheme();
    const cyber = useCyberActive();
    const [sound, setSound] = useCyberPref('sound');
    const [now, setNow] = useState('');

    useEffect(() => {
        const tick = () =>
            setNow(
                new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
            );
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <StatusBar
            className="border-x-0 border-primary/20 bg-card/40 text-[10px]"
            leftContent={
                <>
                    <DecodeText text="SYS://FILEMANAGER" className="text-primary" />
                    <span className="hidden sm:inline">Theme: <span className="text-primary">{GRID_THEME_LABELS[theme]}</span></span>
                </>
            }
            rightContent={
                <>
                    {cyber && (
                        <>
                            <button
                                type="button"
                                onClick={() => setSound(!sound)}
                                title={sound ? 'Mute' : 'Sound on'}
                                className="flex items-center gap-1 text-primary/70 transition-colors hover:text-primary"
                            >
                                {sound ? <Volume2 className="size-3" /> : <VolumeX className="size-3" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => window.dispatchEvent(new Event('cyber-reboot'))}
                                title="Replay boot sequence"
                                className="flex items-center gap-1 text-primary/70 transition-colors hover:text-primary"
                            >
                                <Power className="size-3" /> REBOOT
                            </button>
                        </>
                    )}
                    <span className="tabular-nums text-primary">{now}</span>
                    <span className="flex items-center gap-1.5">
                        <span className="size-1.5 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                        All systems operational
                    </span>
                </>
            }
        />
    );
}
