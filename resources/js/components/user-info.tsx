import { AgentAvatar } from '@/components/thegridcn/agent-avatar';
import { GRID_THEME_HUE, useGridTheme } from '@/hooks/use-grid-theme';
import { type User } from '@/types';

export function UserInfo({ user, showEmail = false }: { user: User; showEmail?: boolean }) {
    const { theme } = useGridTheme();

    return (
        <>
            <AgentAvatar seed={user.email || user.name} size={32} hue={GRID_THEME_HUE[theme]} ring className="shrink-0" />
            <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                {showEmail && <span className="text-muted-foreground truncate text-xs">{user.email}</span>}
            </div>
        </>
    );
}
