import { useCircuit } from '@/hooks/use-circuit';
import { useCyberActive, useCyberPref } from '@/hooks/use-cyber';
import {
    CLASSIC_LABEL,
    CLASSIC_THEME,
    type ClassicMode,
    GRID_THEME_LABELS,
    GRID_THEME_SWATCH,
    GRID_THEMES,
    useGridTheme,
} from '@/hooks/use-grid-theme';
import { Check, CircuitBoard, Monitor, Moon, Power, SunMedium, Volume2, Zap } from 'lucide-react';

const MODE_OPTIONS: { value: ClassicMode; label: string; icon: typeof SunMedium }[] = [
    { value: 'light', label: 'Light', icon: SunMedium },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
];

/** Theme picker for the Appearance settings page (replaces light/dark). */
export function ThemeAppearance() {
    const { theme, mode, updateTheme, setMode, isClassic } = useGridTheme();
    const circuit = useCircuit();
    const cyber = useCyberActive();
    const [glitch, setGlitch] = useCyberPref('glitch');
    const [sound, setSound] = useCyberPref('sound');

    return (
        <div className="space-y-6">
            <div>
                <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">Interface theme</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {/* Classic — clean light/dark */}
                    <button
                        type="button"
                        onClick={() => updateTheme(CLASSIC_THEME)}
                        className={`group relative flex items-center gap-3 rounded border px-3 py-3 text-left transition-colors ${
                            isClassic ? 'border-primary bg-primary/10 glow-border' : 'border-primary/25 hover:border-primary/50'
                        }`}
                    >
                        <span
                            className="size-5 shrink-0 rounded-full ring-1 ring-border"
                            style={{ background: 'linear-gradient(135deg, #fff 0 50%, #18181b 50% 100%)' }}
                        />
                        <span className="flex-1 font-mono text-sm uppercase tracking-wide">{CLASSIC_LABEL}</span>
                        {isClassic && <Check className="size-4 text-primary" />}
                    </button>

                    {GRID_THEMES.map((t) => {
                        const active = theme === t;
                        return (
                            <button
                                key={t}
                                type="button"
                                onClick={() => updateTheme(t)}
                                className={`group relative flex items-center gap-3 rounded border px-3 py-3 text-left transition-colors ${
                                    active ? 'border-primary bg-primary/10 glow-border' : 'border-primary/25 hover:border-primary/50'
                                }`}
                            >
                                <span
                                    className="size-5 shrink-0 rounded-full ring-1 ring-border"
                                    style={{ backgroundColor: GRID_THEME_SWATCH[t], boxShadow: `0 0 10px ${GRID_THEME_SWATCH[t]}` }}
                                />
                                <span className="flex-1 font-mono text-sm uppercase tracking-wide">{GRID_THEME_LABELS[t]}</span>
                                {active && <Check className="size-4 text-primary" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Light / Dark / System — only meaningful for the classic theme. */}
            {isClassic && (
                <div>
                    <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">Appearance</p>
                    <div className="inline-flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
                        {MODE_OPTIONS.map(({ value, label, icon: Icon }) => {
                            const active = mode === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setMode(value)}
                                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                                        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <Icon className="size-4" />
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Cyber-only effects are hidden under the classic theme. */}
            {!isClassic && (
                <div>
                    <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">Effects</p>
                    <button
                        type="button"
                        onClick={circuit.toggle}
                        className={`flex w-full items-center gap-3 rounded border px-3 py-3 text-left transition-colors sm:w-auto ${
                            circuit.enabled ? 'border-primary bg-primary/10 glow-border' : 'border-primary/25 hover:border-primary/50'
                        }`}
                    >
                        <CircuitBoard className="size-5 text-primary" />
                        <span className="flex-1 font-mono text-sm uppercase tracking-wide">Circuit background</span>
                        {circuit.enabled && <Check className="size-4 text-primary" />}
                    </button>
                </div>
            )}

            {cyber && (
                <div>
                    <p className="mb-3 font-mono text-xs uppercase tracking-widest text-primary glow-text">Cyberpunk 2077</p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                        <button
                            type="button"
                            onClick={() => setGlitch(!glitch)}
                            className={`flex items-center gap-3 rounded border px-3 py-3 text-left transition-colors ${
                                glitch ? 'border-primary bg-primary/10 glow-border' : 'border-primary/25 hover:border-primary/50'
                            }`}
                        >
                            <Zap className="size-5 text-primary" />
                            <span className="flex-1 font-mono text-sm uppercase tracking-wide">Glitch transitions</span>
                            {glitch && <Check className="size-4 text-primary" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => setSound(!sound)}
                            className={`flex items-center gap-3 rounded border px-3 py-3 text-left transition-colors ${
                                sound ? 'border-primary bg-primary/10 glow-border' : 'border-primary/25 hover:border-primary/50'
                            }`}
                        >
                            <Volume2 className="size-5 text-primary" />
                            <span className="flex-1 font-mono text-sm uppercase tracking-wide">Sound FX</span>
                            {sound && <Check className="size-4 text-primary" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => window.dispatchEvent(new Event('cyber-reboot'))}
                            className="flex items-center gap-3 rounded border border-primary/25 px-3 py-3 text-left transition-colors hover:border-primary/50"
                        >
                            <Power className="size-5 text-primary" />
                            <span className="flex-1 font-mono text-sm uppercase tracking-wide">Replay boot</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
