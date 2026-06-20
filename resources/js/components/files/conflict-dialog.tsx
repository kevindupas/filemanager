import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';

export type ConflictAction = 'overwrite' | 'keep' | 'skip';
export interface Conflict {
    path: string;
    name: string;
}

const ACTIONS: { key: ConflictAction; label: string }[] = [
    { key: 'overwrite', label: 'Overwrite' },
    { key: 'keep', label: 'Keep both' },
    { key: 'skip', label: 'Skip' },
];

/**
 * Asks the user how to resolve each name collision before a transfer runs.
 * Returns a map of srcPath → action; defaults every conflict to "keep both".
 */
export function ConflictDialog({
    conflicts,
    busy,
    onResolve,
    onCancel,
}: {
    conflicts: Conflict[];
    busy?: boolean;
    onResolve: (resolutions: Record<string, ConflictAction>) => void;
    onCancel: () => void;
}) {
    const [actions, setActions] = useState<Record<string, ConflictAction>>(() =>
        Object.fromEntries(conflicts.map((c) => [c.path, 'keep' as ConflictAction])),
    );

    const setAll = (a: ConflictAction) => setActions(Object.fromEntries(conflicts.map((c) => [c.path, a])));

    return (
        <Dialog open onOpenChange={(o) => !o && onCancel()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="font-mono uppercase tracking-widest">Name conflicts</DialogTitle>
                    <DialogDescription>
                        {conflicts.length} item(s) already exist at the destination. Choose what to do.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap items-center gap-2 border-b border-primary/15 pb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Apply to all:
                    {ACTIONS.map((a) => (
                        <button key={a.key} type="button" onClick={() => setAll(a.key)} className="rounded border border-primary/30 px-2 py-0.5 hover:border-primary hover:text-primary">
                            {a.label}
                        </button>
                    ))}
                </div>

                <div className="max-h-72 space-y-1 overflow-y-auto">
                    {conflicts.map((c) => (
                        <div key={c.path} className="flex items-center justify-between gap-3 rounded px-1 py-1 text-xs hover:bg-primary/5">
                            <span className="truncate font-mono" title={c.path}>
                                {c.name}
                            </span>
                            <div className="flex shrink-0 gap-1">
                                {ACTIONS.map((a) => {
                                    const active = actions[c.path] === a.key;
                                    return (
                                        <button
                                            key={a.key}
                                            type="button"
                                            onClick={() => setActions((p) => ({ ...p, [c.path]: a.key }))}
                                            className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                                                active
                                                    ? a.key === 'overwrite'
                                                        ? 'border-destructive bg-destructive/20 text-destructive'
                                                        : 'border-primary bg-primary/20 text-primary'
                                                    : 'border-border text-muted-foreground hover:border-primary/50'
                                            }`}
                                        >
                                            {a.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <DialogFooter>
                    <Button variant="outline" disabled={busy} onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button className="glow-border" disabled={busy} onClick={() => onResolve(actions)}>
                        Transfer
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
