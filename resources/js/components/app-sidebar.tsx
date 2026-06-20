import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { HUDCornerFrame } from '@/components/thegridcn/hud-corner-frame';
import { usePermissions } from '@/hooks/use-permissions';
import { Link, usePage } from '@inertiajs/react';
import { Activity, Columns2, HardDrive, LayoutGrid, type LucideIcon, ScrollText, Server, Share2, Star, Trash2, Users } from 'lucide-react';
import AppLogo from './app-logo';

interface NavEntry {
    title: string;
    url: string;
    icon: LucideIcon;
    external?: boolean; // non-Inertia (Pulse)
}

export function AppSidebar() {
    const { can, isAdmin } = usePermissions();
    const page = usePage();

    const nav: NavEntry[] = [
        { title: 'Dashboard', url: '/dashboard', icon: LayoutGrid },
        { title: 'Files', url: '/files', icon: HardDrive },
        { title: 'Favorites', url: '/favorites', icon: Star },
        { title: 'Connections', url: '/connections', icon: Server },
        { title: 'Commander', url: '/commander', icon: Columns2 },
    ];
    if (can('delete-files')) nav.push({ title: 'Trash', url: '/trash', icon: Trash2 });
    if (can('share-files')) nav.push({ title: 'Shares', url: '/shares', icon: Share2 });
    if (can('manage-users')) {
        nav.push({ title: 'Users', url: '/admin/users', icon: Users });
        nav.push({ title: 'Activity', url: '/activity', icon: ScrollText });
    }

    const isActive = (url: string) => page.url === url || page.url.startsWith(url + '/') || page.url.startsWith(url + '?');

    const renderItem = (item: NavEntry, index: number) => {
        const active = item.external ? page.url.startsWith(item.url) : isActive(item.url);
        const num = String(index + 1).padStart(2, '0');
        const inner = (
            <>
                <span className="text-[10px] tabular-nums text-primary/40 group-data-[collapsible=icon]:hidden">{num}</span>
                <item.icon />
                <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                {active && (
                    <span className="ml-auto text-[9px] tracking-widest text-primary/70 group-data-[collapsible=icon]:hidden">
                        ACTIVE
                    </span>
                )}
            </>
        );

        return (
            <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={item.title}
                    className="rounded-none border-l-2 border-transparent font-mono text-xs uppercase tracking-wide text-foreground/60 transition-colors hover:text-primary data-[active=true]:border-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:glow-text"
                >
                    {item.external ? (
                        <a href={item.url}>{inner}</a>
                    ) : (
                        <Link href={item.url} prefetch>
                            {inner}
                        </Link>
                    )}
                </SidebarMenuButton>
            </SidebarMenuItem>
        );
    };

    return (
        <Sidebar
            collapsible="icon"
            variant="inset"
            className="[&_[data-sidebar=sidebar]]:relative [&_[data-sidebar=sidebar]]:overflow-hidden [&_[data-sidebar=sidebar]]:rounded [&_[data-sidebar=sidebar]]:border [&_[data-sidebar=sidebar]]:border-primary/30 [&_[data-sidebar=sidebar]]:shadow-[0_0_28px_-16px_var(--glow)]"
        >
            {/* HUD corner brackets on the sidebar panel */}
            <HUDCornerFrame position="top-left" size={20} className="z-30 text-primary/70" />
            <HUDCornerFrame position="top-right" size={20} className="z-30 text-primary/70" />
            <HUDCornerFrame position="bottom-left" size={20} className="z-30 text-primary/70" />
            <HUDCornerFrame position="bottom-right" size={20} className="z-30 text-primary/70" />

            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup className="px-2 py-0">
                    <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-foreground/40">
                        Navigation:&nbsp;<span className="text-primary/60">00.sys</span>
                    </SidebarGroupLabel>
                    <SidebarMenu>{nav.map(renderItem)}</SidebarMenu>
                </SidebarGroup>

                {isAdmin && (
                    <SidebarGroup className="px-2 py-0">
                        <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-foreground/40">
                            Monitoring
                        </SidebarGroupLabel>
                        <SidebarMenu>
                            {renderItem({ title: 'Pulse', url: '/pulse', icon: Activity, external: true }, nav.length)}
                        </SidebarMenu>
                    </SidebarGroup>
                )}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
