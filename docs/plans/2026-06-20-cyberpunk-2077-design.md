# Cyberpunk 2077 Experience — Design

Date: 2026-06-20
Branch: `feat/cyberpunk-2077`

## Goal

An opt-in "Cyberpunk 2077" experience: a 7th selectable theme that, when active,
turns the app into a netrunner terminal — boot sequence, glitch page transitions,
procedural sound, and ambient FX. The 6 existing themes stay untouched.

## Decisions

- **Opt-in 7th theme** (`cyberpunk-2077`), not a global overhaul. Everything is
  gated by `data-theme="cyberpunk-2077"`; other themes are unaffected.
- **Boot sequence**: plays once per session (sessionStorage) + a `REBOOT` button
  in the status bar to replay on demand. Skippable.
- **Sound**: procedural Web Audio (no asset files). Boot + transitions + key
  actions only (no hover beeps). Default OFF. Toggle in **both** the status bar
  and Settings/Appearance.
- **Page transitions**: ~250ms glitch (RGB split + scanline tear + yellow flash)
  on Inertia navigation. Disable toggle in Settings/Appearance.

## Palette (OKLCH)

- Primary: Militech yellow (`#FCEE0A`)
- Accents: electric cyan + glitch red/magenta
- Background: near-black with a faint yellow tint, light grain
- Borders / glow / HUD recolored yellow/cyan

## Preferences (localStorage, like the theme)

- `cyber.glitch` — on/off (Settings)
- `cyber.sound` — on/off (status bar + Settings)
- `cyber.booted` — sessionStorage flag (boot once per session)

## React architecture

`<CyberExperience>` mounted in the app layout, renders effects only when the
2077 theme is active (`useCyberActive()`).

- `BootSequence` — full-screen overlay; typed log lines (real data: user name,
  mounted disks), segmented progress bar, glitch burst, fade-in. Skippable
  (click / Space / Esc).
- `GlitchOverlay` — listens to `router.on('start'|'finish')`; renders the ~250ms
  transition glitch. No-op when `cyber.glitch` is off.
- `useCyberSound` — Web Audio procedural SFX (boot, transition, action beeps).
  No-op when `cyber.sound` is off or theme inactive.
- `DecodeText` — page titles "decrypt" on mount.
- Ambient: yellow scanlines, occasional flicker, hover glitch on key elements.

## Implementation order

1. `cyberpunk-2077` theme tokens (OKLCH) + add to theme registry/switcher.
2. `useCyberActive()` + prefs (localStorage) + Settings toggles.
3. `BootSequence` + REBOOT + sessionStorage.
4. `GlitchOverlay` + Inertia transition hook + glitch toggle.
5. `useCyberSound` (Web Audio) + sound toggle (status bar + Settings).
6. `DecodeText` + scanlines + hover glitch.
7. Build + screenshot verification at each step.

## Risk

All effects gated behind the active theme → the existing themes and pages are
never affected. Glitch/sound are individually disablable for daily use.
