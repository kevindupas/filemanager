import { useCallback, useSyncExternalStore } from 'react';

export const GRID_THEMES = ['tron', 'ares', 'clu', 'athena', 'aphrodite', 'poseidon', 'cyberpunk-2077'] as const;

export type GridTheme = (typeof GRID_THEMES)[number];

/** The clean, professional light/dark theme — sits alongside the cyber themes. */
export const CLASSIC_THEME = 'classic' as const;

/** Any selectable theme: a cyber grid theme or the classic theme. */
export type AppTheme = GridTheme | typeof CLASSIC_THEME;

/** Light/dark selection — only meaningful when the classic theme is active. */
export type ClassicMode = 'light' | 'dark' | 'system';

export const CLASSIC_MODES = ['light', 'dark', 'system'] as const;

export const GRID_THEME_LABELS: Record<GridTheme, string> = {
    tron: 'Tron',
    ares: 'Ares',
    clu: 'Clu',
    athena: 'Athena',
    aphrodite: 'Aphrodite',
    poseidon: 'Poseidon',
    'cyberpunk-2077': 'Cyberpunk 2077',
};

export const CLASSIC_LABEL = 'Classic';

/** Human label for any theme, including the classic theme. */
export function themeLabel(theme: AppTheme): string {
    return theme === CLASSIC_THEME ? CLASSIC_LABEL : GRID_THEME_LABELS[theme];
}

/** Primary hue for hue-tinted components; undefined for the (neutral) classic theme. */
export function themeHue(theme: AppTheme): number | undefined {
    return theme === CLASSIC_THEME ? undefined : GRID_THEME_HUE[theme];
}

/** Approx primary hue per theme (for hue-tinted components like the avatar). */
export const GRID_THEME_HUE: Record<GridTheme, number> = {
    tron: 195,
    ares: 25,
    clu: 55,
    athena: 90,
    aphrodite: 340,
    poseidon: 250,
    'cyberpunk-2077': 103,
};

/** CSS swatch colour per theme (for pickers). */
export const GRID_THEME_SWATCH: Record<GridTheme, string> = {
    tron: 'oklch(0.75 0.18 195)',
    ares: 'oklch(0.6 0.25 25)',
    clu: 'oklch(0.75 0.2 55)',
    athena: 'oklch(0.85 0.18 90)',
    aphrodite: 'oklch(0.7 0.22 340)',
    poseidon: 'oklch(0.6 0.2 250)',
    'cyberpunk-2077': 'oklch(0.92 0.19 103)',
};

const THEME_KEY = 'grid-theme';
const MODE_KEY = 'classic-mode';
const DEFAULT_THEME: AppTheme = 'tron';
const DEFAULT_MODE: ClassicMode = 'system';

function isAppTheme(value: unknown): value is AppTheme {
    return typeof value === 'string' && (value === CLASSIC_THEME || (GRID_THEMES as readonly string[]).includes(value));
}

function isClassicMode(value: unknown): value is ClassicMode {
    return typeof value === 'string' && (CLASSIC_MODES as readonly string[]).includes(value);
}

/* --- shared store so every component reacts to a theme/mode switch --- */

type ThemeState = { theme: AppTheme; mode: ClassicMode };

let state: ThemeState = { theme: DEFAULT_THEME, mode: DEFAULT_MODE };
const listeners = new Set<() => void>();

function getSnapshot(): ThemeState {
    return state;
}

function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

function prefersDark(): boolean {
    return typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false;
}

/** Resolve whether the `.dark` class should be on for a given theme + mode. */
function resolveDark(theme: AppTheme, mode: ClassicMode): boolean {
    if (theme !== CLASSIC_THEME) return true; // cyber themes are inherently dark
    if (mode === 'system') return prefersDark();
    return mode === 'dark';
}

function apply(theme: AppTheme, mode: ClassicMode) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', resolveDark(theme, mode));
    state = { theme, mode };
    listeners.forEach((l) => l());
}

let mediaListenerAttached = false;

/** Call once on app boot (before React renders) to avoid a flash. */
export function initializeGridTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const savedMode = localStorage.getItem(MODE_KEY);
    const theme = isAppTheme(savedTheme) ? savedTheme : DEFAULT_THEME;
    const mode = isClassicMode(savedMode) ? savedMode : DEFAULT_MODE;
    apply(theme, mode);

    // Follow the OS when classic + system; re-apply on OS scheme change.
    if (!mediaListenerAttached && typeof window !== 'undefined' && window.matchMedia) {
        mediaListenerAttached = true;
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (state.theme === CLASSIC_THEME && state.mode === 'system') {
                apply(state.theme, state.mode);
            }
        });
    }
}

export function useGridTheme() {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    const updateTheme = useCallback((next: AppTheme) => {
        localStorage.setItem(THEME_KEY, next);
        apply(next, state.mode);
    }, []);

    const setMode = useCallback((next: ClassicMode) => {
        localStorage.setItem(MODE_KEY, next);
        apply(state.theme, next);
    }, []);

    return {
        theme: snapshot.theme,
        mode: snapshot.mode,
        themes: GRID_THEMES,
        labels: GRID_THEME_LABELS,
        isClassic: snapshot.theme === CLASSIC_THEME,
        updateTheme,
        setMode,
    };
}

/** Lightweight flag for components that only need to flip HUD vs flat rendering. */
export function useThemeMode() {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    return { theme: snapshot.theme, mode: snapshot.mode, isClassic: snapshot.theme === CLASSIC_THEME };
}
