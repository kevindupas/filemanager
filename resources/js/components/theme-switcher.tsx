import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
// DropdownMenuSeparator imported above
import { useCircuit } from '@/hooks/use-circuit';
import { useGridTheme, type GridTheme } from '@/hooks/use-grid-theme';
import { Check, CircuitBoard, Palette } from 'lucide-react';

// A small dot in each theme's accent colour, so the menu previews the palette.
const SWATCH: Record<GridTheme, string> = {
    tron: 'oklch(0.75 0.18 195)',
    ares: 'oklch(0.6 0.25 25)',
    clu: 'oklch(0.75 0.2 55)',
    athena: 'oklch(0.85 0.18 90)',
    aphrodite: 'oklch(0.7 0.22 340)',
    poseidon: 'oklch(0.6 0.2 250)',
    'cyberpunk-2077': 'oklch(0.92 0.19 103)',
};

export function ThemeSwitcher() {
    const { theme, themes, labels, updateTheme } = useGridTheme();
    const circuit = useCircuit();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title="Switch theme" className="glow-border">
                    <Palette className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuLabel className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Theme
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {themes.map((t) => (
                    <DropdownMenuItem key={t} onSelect={() => updateTheme(t)} className="gap-2">
                        <span
                            className="size-3 rounded-full ring-1 ring-border"
                            style={{ backgroundColor: SWATCH[t], boxShadow: `0 0 6px ${SWATCH[t]}` }}
                        />
                        <span className="flex-1">{labels[t]}</span>
                        {theme === t && <Check className="size-4" />}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); circuit.toggle(); }} className="gap-2">
                    <CircuitBoard className="size-4" />
                    <span className="flex-1">Circuit background</span>
                    {circuit.enabled && <Check className="size-4" />}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
