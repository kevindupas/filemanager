import { useCallback, useEffect, useState } from 'react';

export const CYBER_THEME = 'cyberpunk-2077';

type Pref = 'glitch' | 'sound';
const KEY: Record<Pref, string> = { glitch: 'cyber.glitch', sound: 'cyber.sound' };
const DEFAULT: Record<Pref, boolean> = { glitch: true, sound: false };
const EVENT = 'cyber-pref-change';

function isActive(): boolean {
    return typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === CYBER_THEME;
}

/** True only while the Cyberpunk 2077 theme is the active theme. Reacts live. */
export function useCyberActive(): boolean {
    const [active, setActive] = useState(isActive);
    useEffect(() => {
        const obs = new MutationObserver(() => setActive(isActive()));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => obs.disconnect();
    }, []);
    return active;
}

export function readCyberPref(pref: Pref): boolean {
    if (typeof localStorage === 'undefined') return DEFAULT[pref];
    const v = localStorage.getItem(KEY[pref]);
    return v === null ? DEFAULT[pref] : v === 'true';
}

/** A boolean preference (glitch/sound) persisted to localStorage and synced
 *  across every component via a window event. */
export function useCyberPref(pref: Pref): [boolean, (v: boolean) => void] {
    const [value, setValue] = useState<boolean>(() => readCyberPref(pref));

    useEffect(() => {
        const sync = () => setValue(readCyberPref(pref));
        window.addEventListener(EVENT, sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener(EVENT, sync);
            window.removeEventListener('storage', sync);
        };
    }, [pref]);

    const update = useCallback(
        (v: boolean) => {
            localStorage.setItem(KEY[pref], String(v));
            setValue(v);
            window.dispatchEvent(new Event(EVENT));
        },
        [pref],
    );

    return [value, update];
}
