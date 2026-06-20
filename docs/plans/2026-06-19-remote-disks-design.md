# Remote disks (FTP / SFTP / S3) — Design

Date: 2026-06-19

Per-user remote storage connections, mounted on the fly via Flysystem, browsable
alongside the local disk.

## Data model

`connections` table (per user):
- `user_id`, `name`, `type` (sftp|ftp|s3)
- `config` — **encrypted** JSON cast: host/port/username/password/privateKey/
  passphrase/root (sftp+ftp); key/secret/region/bucket/endpoint/path_style (s3)
- timestamps

Model `Connection`: `belongsTo(User)`, `config` cast `encrypted:array`. Only the
owner may read/use/edit (enforced in controller + resolver).

## Runtime

`DiskResolver::resolve(?string $diskKey, User $user)` → `{ key, label, type, isLocal, filesystem }`:
- `local` (or null) → `Storage::disk('local')`, isLocal = true
- `conn_{id}` → load the user's `Connection`, build a Flysystem config array per
  type, `Storage::build($config)`, isLocal = false

`FileManager` becomes disk-agnostic: `useDisk(Filesystem, isLocal, key)`; all ops
go through the active disk (defaults to local). The realpath confinement check
runs **only for local**; remote disks rely on `normalize` (no `..`) + the
adapter's own root.

Every file route accepts `?disk=`. The controller resolves + sets the active
disk before delegating.

## UI

- **Connections** page (`/connections`): list + create/edit/delete + **Test
  connection**. Type-specific form. Nav link.
- **Disk switcher** in the browser toolbar (Local + the user's connections) →
  reloads with `?disk=`.

## Per-disk feature scope

Remote disks: browse, breadcrumb, search, chunked upload, streamed download/
preview, mkdir, rename, delete (**permanent**), move/copy (same disk), zip,
thumbnails (decoded from fetched bytes).

Local only (for now): recycle bin (soft-delete needs same-volume rename), public
shares, quota, favorites. Cross-disk move/copy: later.

## Security

- Credentials encrypted at rest (`encrypted:array` cast).
- Connection bound to its owner; resolver rejects others' ids.
- `normalize` strips `..` on every path; adapters are rooted.
- SFTP: password or private key (+ optional passphrase), key encrypted.

## Dependencies

`league/flysystem-sftp-v3`, `league/flysystem-ftp`, `league/flysystem-aws-s3-v3`.

## Tests

connection CRUD scoped to owner; resolver rejects foreign id; build config per
type; disk-agnostic list works against a fake remote; remote delete is permanent
(no trash row).
