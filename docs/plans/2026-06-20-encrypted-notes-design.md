# Encrypted Notes — Design

Date: 2026-06-20
Branch: `feat/cyberpunk-2077`

## Goal

An Apple-Notes-style page: a list of notes on the left, an editor on the right.
Notes are **encrypted at rest** so a database dump is unreadable.

## Decisions

- **Encryption: server-side at rest** (Laravel `encrypted` cast → AES-256-GCM with
  `APP_KEY`). A DB dump is useless without the key. Multi-device works natively
  (server decrypts for the owner over HTTPS). No passphrase, no lost-data risk.
  (Zero-knowledge E2E was considered but rejected: the user only requires "encrypted
  in the DB", and E2E adds passphrase friction + unrecoverable-loss risk.)
- **Title = first line** of the body (Apple style), derived in the UI — not stored
  separately.
- **Markdown** with an Edit / Preview toggle (raw markdown editing + rendered view).

## Data model

`notes` table:
- `id`, `user_id` (FK, cascade delete)
- `body` (text, **`encrypted` cast**)
- `pinned` (bool, default false)
- timestamps

`Note` model: `encrypted` cast on `body`, `belongsTo(User)`, owner scope.

## Backend

`NoteController` (auth, owner-scoped):
- `index` — Inertia page with the user's notes (decrypted body sent to the owner).
- `store` — create empty note, return it.
- `update` — save body (auto-save, debounced from the client).
- `destroy` — delete.
- `togglePin` — optional.

Routes under `auth`, all scoped `where('user_id', $request->user()->id)`; 403 on
foreign notes.

## Frontend (`pages/notes/index.tsx`)

- Two-pane GridPanel layout (internal scroll, like the rest of the app).
- Left: list — auto-title (first line), 1-line preview, relative date, pinned first,
  search filter, "New note" button.
- Right: editor — textarea (markdown source) + Edit/Preview toggle (`react-markdown`
  + `remark-gfm`). Auto-save on change (debounce ~600ms) via fetch to `update`.
- Empty state + "no note selected" state, themed HUD.
- Cyberpunk: decode title, glitch — inherited from the global theme layer.

## Security

- `body` encrypted at rest (AES-256-GCM). DB dump = ciphertext only.
- Per-user scoping on every endpoint; 403 on others' notes.
- Served over HTTPS in prod.

## Out of scope (YAGNI)

Folders/tags, sharing, rich-text WYSIWYG, attachments, version history.
