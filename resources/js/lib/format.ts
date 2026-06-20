/** Human-readable file size from a byte count. */
export function formatBytes(bytes: number | null): string {
    if (bytes === null) return '—';
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);

    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Format a unix timestamp (seconds) as a compact local date-time. */
export function formatDate(unixSeconds: number): string {
    if (!unixSeconds) return '—'; // 0 = unknown (e.g. SFTP folders have no mtime)
    const d = new Date(unixSeconds * 1000);
    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}
