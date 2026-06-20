import { useCallback, useEffect, useState } from 'react';

const KEY = 'fm-circuit';

/** Toggle for the decorative circuit background (persisted in localStorage). */
export function useCircuit() {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        setEnabled(localStorage.getItem(KEY) === '1');
        const onChange = () => setEnabled(localStorage.getItem(KEY) === '1');
        window.addEventListener('fm-circuit-change', onChange);
        return () => window.removeEventListener('fm-circuit-change', onChange);
    }, []);

    const toggle = useCallback(() => {
        const next = localStorage.getItem(KEY) === '1' ? '0' : '1';
        localStorage.setItem(KEY, next);
        window.dispatchEvent(new Event('fm-circuit-change'));
    }, []);

    return { enabled, toggle };
}
