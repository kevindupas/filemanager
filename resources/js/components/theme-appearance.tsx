import { useCircuit } from '@/hooks/use-circuit';
import { GRID_THEME_LABELS, GRID_THEME_SWATCH, GRID_THEMES, useGridTheme } from '@/hooks/use-grid-theme';
import { Check, CircuitBoard } from 'lucide-react';

/** Theme picker for the Appearance settings page (replaces light/dark). */
export function ThemeAppearance() {
    const { theme, updateTheme } = useGridTheme();
    const circuit = useCircuit();

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
        </div>
    );
}
