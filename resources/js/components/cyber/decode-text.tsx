import { useCyberActive } from '@/hooks/use-cyber';
import { useEffect, useState } from 'react';

const SCRAMBLE = '!<>-_\\/[]{}=+*^?#@01';

/** Renders text that "decrypts" from scrambled glyphs on mount — only under the
 *  Cyberpunk 2077 theme; otherwise it's a plain span. */
export function DecodeText({ text, className }: { text: string; className?: string }) {
    const cyber = useCyberActive();
    const [display, setDisplay] = useState(text);

    useEffect(() => {
        if (!cyber) {
            setDisplay(text);
            return;
        }
        let frame = 0;
        const frames = 16;
        const id = window.setInterval(() => {
            frame++;
            const revealed = (frame / frames) * text.length;
            setDisplay(
                text
                    .split('')
                    .map((c, i) => (i < revealed || c === ' ' ? c : SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]))
                    .join(''),
            );
            if (frame >= frames) {
                window.clearInterval(id);
                setDisplay(text);
            }
        }, 35);
        return () => window.clearInterval(id);
    }, [text, cyber]);

    return <span className={className}>{display}</span>;
}
