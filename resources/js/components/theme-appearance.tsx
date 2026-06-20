import { useCircuit } from '@/hooks/use-circuit';
import { useCyberActive, useCyberPref } from '@/hooks/use-cyber';
import { GRID_THEME_LABELS, GRID_THEME_SWATCH, GRID_THEMES, useGridTheme } from '@/hooks/use-grid-theme';
import { Check, CircuitBoard, Power, Volume2, Zap } from 'lucide-react';

/** Theme picker for the Appearance settings page (replaces light/dark). */
export function ThemeAppearance() {
    const { theme, updateTheme } = useGridTheme();
    const circuit = useCircuit();
    const cyber = useCyberActive();
    const [glitch, setGlitch] = useCyberPref('glitch');
    const [sound, setSound] = useCyberPref('sound');

    return (
        <div className="space-y-6">
            <div>
                <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">Interface theme</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
