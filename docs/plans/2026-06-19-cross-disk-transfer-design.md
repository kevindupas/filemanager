# Cross-disk move / copy — Design

Date: 2026-06-19

Move or copy files/folders between any two disks (local ↔ SFTP/FTP/S3, or
remote ↔ remote). Phase B = picker-based; Phase A (dual-pane) follows.

## Backend

`move`/`copy` accept `disk` (source = current), `destDisk` (default = source),
`destination`, `paths`.

- **Same disk** → existing native `FileManager::transfer` (fast rename/copy).
- **Cross disk** → stream copy file-by-file (`readStream` → `writeStream`),
  directories recursively. Move = copy then delete the source (recycle bin if
  the source is local, permanent if remote).

New FileManager helpers (operate on a passed Filesystem, not just the active one):
- `isDirOn(fs, path)`, `uniqueNameOn(fs, path)`, `copyAcross(from, to, src, target, isDir)`.

Collisions resolved on the **destination** disk (move → skip+error, copy →
` (copy)` suffix). `destDisk` resolved via `DiskResolver` (scoped to the user).

## Frontend

`FolderPicker` gains a **disk selector** (available disks). It navigates the
selected disk's tree (`files.dirs?disk=`) and `onConfirm(destDisk, destPath)`.
The browser's `moveTo(paths, destDisk, destPath, mode)` posts `disk` (source) +
`destDisk` + `destination` + `paths`.

## Phase A (next) — dual-pane

Toggle to a two-pane commander: each pane is an extracted `<Pane>` (disk + path
+ selection); drag between panes runs the cross-transfer. Out of scope here.

## Tests

cross-disk copy duplicates onto the target disk; cross-disk move removes the
source; same-disk still uses the native path; foreign destDisk rejected.
