// Procedural Web Audio SFX for the Cyberpunk 2077 experience. No asset files —
// everything is synthesised from oscillators. Gated by the caller (sound pref).

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        try {
            ctx = new Ctor();
        } catch {
            return null;
        }
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
}

/** Browsers block audio until a user gesture — call this from a click/keydown. */
export function unlockAudio(): void {
    audio();
}

function blip(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; at?: number; slideTo?: number } = {}): void {
    const ac = audio();
    if (!ac) return;
    const t0 = ac.currentTime + (opts.at ?? 0);
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = opts.type ?? 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + dur);
    const peak = opts.gain ?? 0.06;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, gain = 0.04, at = 0): void {
    const ac = audio();
    if (!ac) return;
    const frames = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    g.gain.value = gain;
    const t0 = ac.currentTime + at;
    src.connect(g).connect(ac.destination);
    src.start(t0);
}

/** Boot-up: low drone + rising scan blips + confirm chord. */
export function playBoot(): void {
    if (!audio()) return;
    blip(60, 1.6, { type: 'sawtooth', gain: 0.04 }); // drone
    for (let i = 0; i < 6; i++) blip(220 + i * 90, 0.07, { type: 'square', gain: 0.04, at: 0.15 + i * 0.18 });
    blip(523, 0.12, { type: 'square', gain: 0.05, at: 1.4 });
    blip(784, 0.18, { type: 'square', gain: 0.05, at: 1.5 });
}

/** Page transition: quick noise tear + downward digital click. */
export function playTransition(): void {
    noise(0.06, 0.03);
    blip(900, 0.05, { type: 'square', gain: 0.035, slideTo: 300 });
}

/** Key action confirm (transfer done, etc.). */
export function playAction(): void {
    blip(660, 0.06, { type: 'square', gain: 0.045 });
    blip(990, 0.09, { type: 'square', gain: 0.045, at: 0.06 });
}
