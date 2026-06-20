import { useCallback, useEffect, useState } from 'react';

export const GRID_THEMES = ['tron', 'ares', 'clu', 'athena', 'aphrodite', 'poseidon'] as const;

export type GridTheme = (typeof GRID_THEMES)[number];

export const GRID_THEME_LABELS: Record<GridTheme, string> = {
    tron: 'Tron',
    ares: 'Ares',
    clu: 'Clu',
    athena: 'Athena',
    aphrodite: 'Aphrodite',
    poseidon: 'Poseidon',
};

/** Approx primary hue per theme (for hue-tinted components like the avatar). */
export const GRID_THEME_HUE: Record<GridTheme, number> = {
    tron: 195,
    ares: 25,
    clu: 55,
    athena: 90,
    aphrodite: 340,
    poseidon: 250,
};

/** CSS swatch colour per theme (for pickers). */
export const GRID_THEME_SWATCH: Record<GridTheme, string> = {
    tron: 'oklch(0.75 0.18 195)',
    ares: 'oklch(0.6 0.25 25)',
    clu: 'oklch(0.75 0.2 55)',
    athena: 'oklch(0.85 0.18 90)',
    aphrodite: 'oklch(0.7 0.22 340)',
    poseidon: 'oklch(0.6 0.2 250)',
};

const STORAGE_KEY = 'grid-theme';
const DEFAULT_THEME: GridTheme = 'tron';

function isGridTheme(value: unknown): value is GridTheme {
    return typeof value === 'string' && (GRID_THEMES as readonly string[]).includes(value);
}

function apply(theme: GridTheme) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    // Themes are inherently dark; keep the `dark` class on so shadcn's
    // dark: variants stay consistent with the cyberpunk palette.
    root.classList.add('dark');
}

/** Call once on app boot (before React renders) to avoid a flash. */
export function initializeGridTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    apply(isGridTheme(saved) ? saved : DEFAULT_THEME);
}

export function useGridTheme() {
    const [theme, setTheme] = useState<GridTheme>(DEFAULT_THEME);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        setTheme(isGridTheme(saved) ? saved : DEFAULT_THEME);
    }, []);

    const updateTheme = useCallback((next: GridTheme) => {
        setTheme(next);
        localStorage.setItem(STORAGE_KEY, next);
        apply(next);
    }, []);

    return { theme, themes: GRID_THEMES, labels: GRID_THEME_LABELS, updateTheme };
}
