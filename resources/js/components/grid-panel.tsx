import { cn } from '@/lib/utils';
import { useThemeMode } from '@/hooks/use-grid-theme';

/**
 * Panel shell. Under cyber themes: primary-tinted border, scanline overlay,
 * optional label bar and L-shaped corner brackets. Under the classic theme it
 * collapses to a plain shadcn card so the look stays clean/pro.
 */
export function GridPanel({
    label,
    className,
    bodyClassName,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement> & { label?: string; bodyClassName?: string }) {
    const { isClassic } = useThemeMode();

    return (
        <div
            className={cn(
                'relative overflow-hidden',
                isClassic
                    ? 'rounded-xl border border-border bg-card shadow-sm'
                    : 'rounded border border-primary/30 bg-card/80 backdrop-blur-sm',
                className,
            )}
            {...props}
        >
            {!isClassic && (
                <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)]" />
            )}

            {label && (
                <div className={cn(
                    'relative border-b px-4 py-2 text-xs text-muted-foreground',
                    isClassic ? 'border-border font-medium' : 'border-primary/20 font-mono text-[10px] uppercase tracking-widest text-foreground/50',
                )}>
                    {label}
                </div>
            )}

            <div className={cn('relative overflow-x-auto', bodyClassName)}>{children}</div>

            {!isClassic && (
                <>
                    <div className="pointer-events-none absolute left-0 top-0 size-3 border-l-2 border-t-2 border-primary/50" />
                    <div className="pointer-events-none absolute right-0 top-0 size-3 border-r-2 border-t-2 border-primary/50" />
                    <div className="pointer-events-none absolute bottom-0 left-0 size-3 border-b-2 border-l-2 border-primary/50" />
                    <div className="pointer-events-none absolute bottom-0 right-0 size-3 border-b-2 border-r-2 border-primary/50" />
                </>
            )}
        </div>
    );
}
