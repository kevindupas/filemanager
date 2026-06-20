import { StatusBar } from '@/components/thegridcn/status-bar';
import { GRID_THEME_LABELS, useGridTheme } from '@/hooks/use-grid-theme';
import { useEffect, useState } from 'react';

/** Thin retro HUD status bar across the top of the working area. */
export function SystemStatusBar() {
    const { theme } = useGridTheme();
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
                    <span className="text-primary">SYS://FILEMANAGER</span>
                    <span className="hidden sm:inline">Theme: <span className="text-primary">{GRID_THEME_LABELS[theme]}</span></span>
                </>
            }
            rightContent={
                <>
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
