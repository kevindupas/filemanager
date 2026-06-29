# FileManager

A self-hostable, **multi-tenant** file manager and lightweight personal
workspace. Each account is fully isolated: its own files, trash, shares, notes
and tasks. Browse, upload (large/resumable), download (streamed), share between
accounts, version files, and reach everything from the outside over a REST API
or WebDAV.

Built on the Laravel + React starter kit: **Laravel 12 · Inertia 2 · React 19 ·
TypeScript · Tailwind 4 · shadcn/ui**. Ships with a classic light/dark theme
plus seven cyber/Tron themes ([thegridcn](https://thegridcn.com) tokens).

## Features

- **Per-user isolation** — every account is confined to its own storage
  partition (`storage/app/private/users/{id}`). No account can ever see or touch
  another's files, trash, shares or thumbnails.
- **First-run install wizard** (`/install`) — system checks, instance name,
  first admin account, default quota. No credentials ship hardcoded.
- **Per-user quotas** — global default + per-account override (admin), counted
  against the user's real usage (versions included), enforced on upload.
- **Files** — browse, search, chunked/resumable upload, streamed download, ZIP
  download, rename/move/copy, image thumbnails, grid/list view, drag-to-upload.
- **File versioning** — overwrites snapshot the previous bytes (hidden
  `.versions/`, capped, quota-counted); list / download / restore from the file
  info dialog.
- **Recycle bin + retention** — soft-delete to a per-user trash; restore or
  purge; scheduled auto-purge after a configurable number of days.
- **Internal sharing** — share a file or folder with another account
  (read or read+write), browse it under *Shared with me*, with per-file
  comments. Writes land in (and count against) the owner's storage.
- **Public share links** — single-file public links with optional expiry +
  password, served at `/s/{token}` (rate-limited).
- **Notes** — encrypted-at-rest rich-text notes (TipTap), mobile-friendly.
- **Tasks** — personal to-do list with priorities, due dates and one-shot
  **email reminders**.
- **Activity log** — every user sees their own actions; admins can widen to
  everyone.
- **Remote connections** — per-user SFTP / FTP(S) / S3 (incl. MinIO),
  credentials encrypted at rest; mounted on the fly via Flysystem.
- **External access** — personal API tokens (Settings › API tokens) for a
  **REST API** (`/api/v1`) and a **WebDAV** endpoint (`/api/webdav`) you can
  mount; both scoped to the token owner's partition.
- **2FA** (TOTP, recovery codes) via Fortify · roles & permissions via
  spatie/laravel-permission · performance monitoring via Laravel Pulse (admins).

## Quick start with Docker (recommended)

The stack runs the app (FrankenPHP), a queue worker, a scheduler, PostgreSQL and
Redis.

```bash
cp .env.docker.example .env     # then edit secrets (DB_PASSWORD, APP_URL…)
docker compose up -d --build
docker compose exec app php artisan key:generate   # first run only
```

Open `http://<host>:8080` — the **install wizard** walks you through creating
your admin account. That's it.

Notes:
- Set a strong `DB_PASSWORD` and a real `APP_URL` in `.env`.
- For email reminders, configure `MAIL_*` (defaults to the log driver, so
  reminders are written to the container logs and nothing breaks without SMTP).
- User files persist in the `storage` volume; the database in `pgdata`.

## Manual install (development)

Prerequisites: PHP **8.4+**, Composer 2, Node 20+/npm, PostgreSQL.

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate

# set DB_* in .env, then:
php artisan migrate          # roles/permissions are seeded; no admin account

# run it
php artisan serve            # terminal 1
npm run dev                  # terminal 2
```

Open the served URL → you're sent to `/install` to create the first admin.

For email reminders + trash retention in dev, run the scheduler:
`php artisan schedule:work` (or trigger manually: `php artisan tasks:remind`,
`php artisan trash:purge`).

## External access

Create a token in **Settings › API tokens**, then:

```bash
# REST
curl -H "Authorization: Bearer <token>" https://<host>/api/v1/files
curl -H "Authorization: Bearer <token>" -F file=@photo.jpg https://<host>/api/v1/files

# WebDAV — mount https://<host>/api/webdav with any username and the token as the password
```

## Configuration

Key env vars (see `config/filemanager.php`):

| Var | Default | Purpose |
| --- | --- | --- |
| `FILEMANAGER_QUOTA_GB` | `50` | Default per-user quota (0 = unlimited) |
| `FILEMANAGER_MAX_VERSIONS` | `20` | File versions kept per path |
| `FILEMANAGER_TRASH_RETENTION_DAYS` | `30` | Auto-purge trash after N days (0 = keep) |

## Tests

```bash
php artisan test
```

Covers per-user isolation, quotas, install/onboarding, sharing (read/write/
comments), versioning, retention, external access (tokens/REST/WebDAV), tasks
and the core file operations.
