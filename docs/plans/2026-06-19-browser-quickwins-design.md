# Browser Quick Wins — Design

Date: 2026-06-19

Round out the v1 file browser before tackling v2 (trash, share links). Four
features: move/copy, multi-select + bulk actions, sortable columns, recursive
search.

## Permissions

- `move`, `copy`, `search` → any authenticated user (consistent with `rename`,
  which is already open).
- bulk `delete` → `delete-files` (unchanged).
- All operations stay confined to the `local` disk root via
  `FileManager::normalize` + `absolutePath`.

## Backend

### Move / Copy — `POST /files/move`, `POST /files/copy`
- Input: `paths: string[]` (sources), `destination: string` (a folder, "" = root).
- Validate: destination is an existing directory under root; each source exists
  under root.
- Guards: cannot move/copy a directory into itself or a descendant; cannot move
  onto its own current location (no-op skip).
- Collisions: **move** → skip + collect error; **copy** → auto-suffix
  ` (copy)`, ` (copy 2)`, …
- Returns `back()` with a `success` count and, if any, an `error` summary.

### Recursive search — `GET /files/search?q=&path=`
- Scans `path` downward (root = global). Case-insensitive substring match on
  the basename, files and folders.
- Caps at 500 results, sets `truncated: true` when exceeded.
- Returns the same entry shape as `list` but with full relative paths.
- Rendered by the existing `files/browser` page in a "search results" mode.

### Bulk delete — extend `DELETE /files`
- Accept `paths: string[]` (fallback to single `path` for back-compat).
- Loops, deletes each (file or directory), still gated `delete-files`.

### Folder picker source — `GET /files/dirs?path=`
- JSON: `{ path, breadcrumbs, dirs: [{name, path}] }` — subdirectories only, so
  the Move/Copy modal can navigate the tree lazily.

## Frontend (`files/browser.tsx`)

- **Selection**: `Set<string>` of paths. Leftmost checkbox column + header
  select-all. Ctrl-click toggles one; Shift-click selects a range.
- **Bulk bar**: shown when selection non-empty — Move, Copy, Download (triggers
  N sequential downloads), Delete (if `can.delete`).
- **Sort**: local `{ key: 'name'|'size'|'modified', dir: 'asc'|'desc' }`,
  clickable headers, directories always first.
- **Search**: debounced input in the toolbar → Inertia visit
  `files.index?search=q&path=current`. Results view lists matches (file → open
  viewer, folder → navigate). Clearing returns to the normal listing.
- **Move/Copy modal** (`FolderPicker`): navigates folders via `/files/dirs`,
  shows breadcrumb, "Move here" / "Copy here" button targets current path.
- **Drag & drop**: rows are draggable; folder rows and breadcrumb crumbs are
  drop targets → move. (Copy stays in the menu to keep DnD unambiguous.)

## Tests

- move file/folder; copy with collision auto-suffix; move-into-descendant
  blocked; recursive search finds nested matches + respects scope; bulk delete
  multiple; `/files/dirs` returns only subdirectories.
