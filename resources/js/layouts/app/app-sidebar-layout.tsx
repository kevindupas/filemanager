import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { CommandPalette } from '@/components/command-palette';
import { FlashToaster } from '@/components/flash-toaster';
import { SystemStatusBar } from '@/components/system-status-bar';
import { TransfersTray } from '@/components/transfers-tray';
import { CircuitBackground } from '@/components/thegridcn/circuit-background';
import { GridScanOverlay } from '@/components/thegridcn/grid-scan-overlay';
import { HUDCornerFrame } from '@/components/thegridcn/hud-corner-frame';
import { useCircuit } from '@/hooks/use-circuit';
import { type BreadcrumbItem } from '@/types';

export default function AppSidebarLayout({ children, breadcrumbs = [] }: { children: React.ReactNode; breadcrumbs?: BreadcrumbItem[] }) {
    const { enabled } = useCircuit();

    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar">
                {/* Whole working area (header + status bar + content) framed as a retro HUD viewport.
                    Fixed to the viewport height so inner content (e.g. commander panes) scrolls
                    internally instead of growing the page. */}
                <div className="relative flex h-[calc(100svh-1rem)] flex-col overflow-hidden rounded border border-primary/25">
                    {/* background layers */}
                    {enabled && <CircuitBackground className="absolute inset-0" opacity={0.18} />}
                    <GridScanOverlay className="z-0" />

                    {/* HUD corner brackets accenting the full border */}
                    <HUDCornerFrame position="top-left" size={20} className="z-20 text-primary/70" />
                    <HUDCornerFrame position="top-right" size={20} className="z-20 text-primary/70" />
                    <HUDCornerFrame position="bottom-left" size={20} className="z-20 text-primary/70" />
                    <HUDCornerFrame position="bottom-right" size={20} className="z-20 text-primary/70" />

                    <div className="relative z-10 flex flex-1 flex-col overflow-auto">
                        <AppSidebarHeader breadcrumbs={breadcrumbs} />
                        <SystemStatusBar />
                        {children}
                    </div>
                </div>
            </AppContent>
            <CommandPalette />
            <FlashToaster />
            <TransfersTray />
        </AppShell>
    );
}
