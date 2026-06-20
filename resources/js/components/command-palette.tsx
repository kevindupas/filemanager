import { CommandMenu } from '@/components/thegridcn/command-menu';
import { useCircuit } from '@/hooks/use-circuit';
import { GRID_THEME_LABELS, GRID_THEMES, useGridTheme } from '@/hooks/use-grid-theme';
import { usePermissions } from '@/hooks/use-permissions';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

/** Global ⌘K / Ctrl+K command palette: navigation, theme, circuit toggle. */
export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const { can } = usePermissions();
    const { updateTheme } = useGridTheme();
    const circuit = useCircuit();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen((o) => !o);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const go = (url: string) => () => router.visit(url);

    const items = [
        { label: 'Dashboard', group: 'Go to', shortcut: 'G D', onSelect: go('/dashboard') },
        { label: 'Files', group: 'Go to', shortcut: 'G F', onSelect: go('/files') },
        ...(can('delete-files') ? [{ label: 'Trash', group: 'Go to', onSelect: go('/trash') }] : []),
        ...(can('share-files') ? [{ label: 'Shares', group: 'Go to', onSelect: go('/shares') }] : []),
        ...(can('manage-users')
            ? [
                  { label: 'Users', group: 'Go to', onSelect: go('/admin/users') },
                  { label: 'Activity', group: 'Go to', onSelect: go('/activity') },
              ]
            : []),
        {
            label: circuit.enabled ? 'Disable circuit background' : 'Enable circuit background',
            group: 'View',
            onSelect: () => circuit.toggle(),
        },
        ...GRID_THEMES.map((t) => ({
            label: `Theme: ${GRID_THEME_LABELS[t]}`,
            group: 'Theme',
            onSelect: () => updateTheme(t),
        })),
    ];

    return <CommandMenu open={open} onOpenChange={setOpen} items={items} label="Command" placeholder="Search commands…" />;
}
