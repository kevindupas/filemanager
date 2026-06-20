# FileManager

A small, modern web file manager for a personal server (1–2 users). Browse,
upload (large/resumable), download (streamed), and manage files on Laravel's
local disk — with roles/permissions and performance monitoring.

Built on the official **Laravel React starter kit**: Laravel 12 · Inertia 2 ·
React 19 · TypeScript · Tailwind 4 · shadcn/ui. Theming uses the
[thegridcn](https://thegridcn.com) cyberpunk/Tron token sets (6 switchable
themes).

## Stack

- **Laravel 12** (PHP 8.3+) with the React starter kit auth (login provided by
  the kit — not rewritten)
- **spatie/laravel-permission** — roles & permissions
- **pion/laravel-chunk-upload** + **resumable.js** — chunked/resumable uploads
- **laravel/pulse** — performance monitoring (DB storage, no Redis)
- **PostgreSQL**
- Files live on Laravel's `local` disk only (`storage/app/private`)

## Roles & permissions

Two roles, four permissions (minimal by design):

| Permission        | admin | user | Notes                                  |
| ----------------- | :---: | :--: | -------------------------------------- |
| `manage-users`    |   ✓   |      | Account administration page            |
| `upload-files`    |   ✓   |      | Chunked upload                         |
| `delete-files`    |   ✓   |      | Delete (to trash) + recycle bin mgmt   |
| `create-folders`  |   ✓   |      | mkdir                                  |
| `share-files`     |   ✓   |      | Create/revoke public share links       |
| browse + download |   ✓   |  ✓   | Open to **any authenticated user**     |
| rename/move/copy/search |   ✓   |  ✓   | Open to any authenticated user   |

Every sensitive action is gated **both** server-side (route middleware) and in
the UI (buttons hidden when not allowed). The server is always the source of
truth.

## Recycle bin & share links

- **Trash** (`/trash`): deleting moves items to a `trash` disk (outside the
  browsable root) and records them in `trashed_items`. Restore puts them back
  (suffixed if the name is taken); permanent delete / empty wipe them.
- **Share links** (`/shares`): `share-files` users create public links to a
  single file (optional expiry + password). Public access lives at `/s/{token}`
  (rate-limited), re-validates expiry/password and that the file still exists,
  and never exposes anything outside the disk root.

## Power features

- **Zip download** — folders and multi-selections stream as a ZIP on the fly
  (`maennchen/zipstream-php`), nothing buffered to disk.
- **Thumbnails + grid view** — image thumbnails (`intervention/image`, cached on
  a dedicated `thumbs` disk, keyed by mtime). Toggle list ↔ grid in the toolbar.
- **Activity log** (`/activity`, admin) — `spatie/laravel-activitylog` records
  uploads, deletes, renames, moves/copies, shares, trash and user actions.
- **Toasts** (sonner), **keyboard shortcuts** (`/` search, `Del` delete, `F2`
  rename, `Ctrl/Cmd+A` select all, `Esc` clear), and **drop-to-upload** anywhere
  on the browser.

Extra disks (all outside the browsable root): `chunks` (resumable uploads),
`trash` (recycle bin), `thumbs` (thumbnail cache).

## Remote connections (SFTP / FTP / S3)

- Per-user, in *Connections*: add SFTP (password or private key), FTP/FTPS, or
  S3 (incl. MinIO via path-style endpoint). Credentials are **encrypted at
  rest** (`connections.config` cast `encrypted:array`); only the owner can use
  or edit them. "Test connection" verifies before saving.
- A disk switcher in the browser toolbar lists Local + your connections. Disks
  are mounted on the fly via Flysystem (`DiskResolver` → `Storage::build`).
- Remote disks support browse/search/upload/download/preview/mkdir/rename/
  move/copy/zip/thumbnails. **Recycle bin, shares, quota and favorites are
  local-only** — on remote disks delete is permanent.

## Two-factor auth & quota

- **2FA** (TOTP) via `laravel/fortify` — opt-in per user in *Settings › Two-factor*
  (QR enrollment, confirmation, recovery codes). Login stays on the starter
  kit's controller, which defers to Fortify's challenge when 2FA is confirmed.
- **Storage quota** — `FILEMANAGER_QUOTA_GB` (config `filemanager.quota_gb`, 0 =
  unlimited). Shown on the dashboard and **enforced on upload** (the assembled
  file is rejected with 422 if it would exceed the quota).

## Security

- All file operations are confined to the root of the `local` disk.
- Incoming paths are normalised so `../` sequences can never escape the root
  (`App\Services\FileManager::normalize`), with an extra realpath check against
  the root for existing targets (defends against symlinks).
- `/pulse` is restricted to admins via the `viewPulse` gate (spatie role).
- Downloads are **streamed** (`streamDownload`) — files are never fully loaded
  into memory. See `FileController::download` for where to wire nginx
  `X-Accel-Redirect` later.

## Prerequisites

- PHP **8.3+** (the kit requires it; e.g. via Laravel Herd)
- Composer 2
- Node 20+ / npm
- PostgreSQL with a database named `filemanager`

## Install

```bash
# 1. Dependencies
composer install
npm install

# 2. Environment
cp .env.example .env   # if you don't already have a .env
php artisan key:generate
```

Set the database in `.env` (defaults assume a local Postgres):

```dotenv
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5433          # adjust to your Postgres port (5432 is the default)
DB_DATABASE=filemanager
DB_USERNAME=postgres
DB_PASSWORD=
```

```bash
# 3. Migrate + seed roles, permissions, and the first admin
php artisan migrate --seed
```

## Run

```bash
# Terminal 1 — Laravel
php artisan serve

# Terminal 2 — Vite
npm run dev
```

Then open the served URL and log in.

For a production-style build instead of `npm run dev`:

```bash
npm run build
```

## Test accounts

Created by the seeder (`database/seeders/RolesAndPermissionsSeeder.php`):

| Role  | Email                     | Password   |
| ----- | ------------------------- | ---------- |
| admin | `admin@filemanager.test`  | `password` |
| user  | `user@filemanager.test`   | `password` |

The `user` account has no special permissions — use it to verify that upload,
delete, mkdir, the admin page, and `/pulse` are all blocked.

## Themes

Six switchable themes (Tron, Ares, Clu, Athena, Aphrodite, Poseidon) via the
palette button in the sidebar footer. The choice persists in `localStorage`
and is applied through a `data-theme` attribute on `<html>`.

## Tests

```bash
php artisan test
```

`tests/Feature/FileManagerTest.php` covers auth, path-traversal confinement,
permission gating for each action, streamed download, and the Pulse gate.

## Useful paths

- File backend: `app/Http/Controllers/FileController.php`,
  `app/Services/FileManager.php`
- Admin users: `app/Http/Controllers/Admin/UserController.php`
- Routes: `routes/web.php`
- Browser UI: `resources/js/pages/files/browser.tsx`
- Upload widget: `resources/js/components/files/upload-dialog.tsx`
- Admin UI: `resources/js/pages/admin/users.tsx`
- Theme: `resources/css/app.css`, `resources/js/hooks/use-grid-theme.tsx`
