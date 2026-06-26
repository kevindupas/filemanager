import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { CommandPalette } from '@/components/command-palette';
import { CyberExperience } from '@/components/cyber/cyber-experience';
import { FlashToaster } from '@/components/flash-toaster';
import { SystemStatusBar } from '@/components/system-status-bar';
import { TransfersTray } from '@/components/transfers-tray';
import { CircuitBackground } from '@/components/thegridcn/circuit-background';
import { GridScanOverlay } from '@/components/thegridcn/grid-scan-overlay';
import { HUDCornerFrame } from '@/components/thegridcn/hud-corner-frame';
import { useCircuit } from '@/hooks/use-circuit';
import { useThemeMode } from '@/hooks/use-grid-theme';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';

export default function AppSidebarLayout({ children, breadcrumbs = [] }: { children: React.ReactNode; breadcrumbs?: BreadcrumbItem[] }) {
    const { enabled } = useCircuit();
    const { isClassic } = useThemeMode();

    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar">
                {/* Whole working area (header + status bar + content) framed as a retro HUD viewport
                    under cyber themes; a plain framed viewport under the classic theme.
                    Fixed to the viewport height so inner content (e.g. commander panes) scrolls
                    internally instead of growing the page. */}
                <div className={cn(
                    'relative flex h-[calc(100svh-1rem)] flex-col overflow-hidden rounded border',
                    isClassic ? 'border-primary/30' : 'border-primary/25',
                )}>
                    {/* background layers (self-gate to null under classic) */}
                    {enabled && <CircuitBackground className="absolute inset-0" opacity={0.18} />}
                    <GridScanOverlay className="z-0" />

                    {/* HUD corner brackets accenting the full border (self-gate to null under classic) */}
                    <HUDCornerFrame position="top-left" size={20} className="z-20 text-primary/70" />
                    <HUDCornerFrame position="top-right" size={20} className="z-20 text-primary/70" />
                    <HUDCornerFrame position="bottom-left" size={20} className="z-20 text-primary/70" />
                    <HUDCornerFrame position="bottom-right" size={20} className="z-20 text-primary/70" />

                    <div className="relative z-10 flex flex-1 flex-col overflow-auto">
                        <AppSidebarHeader breadcrumbs={breadcrumbs} />
                        {!isClassic && <SystemStatusBar />}
                        {children}
                    </div>
                </div>
            </AppContent>
            <CommandPalette />
            <FlashToaster />
            <TransfersTray />
            <CyberExperience />
        </AppShell>
    );
}
