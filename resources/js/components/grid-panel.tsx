import { cn } from '@/lib/utils';

/**
 * The thegridcn data-table shell: primary-tinted border, scanline overlay,
 * optional label bar and L-shaped corner brackets. Wrap any table/list to get
 * the cyberpunk panel look without giving up custom row logic.
 */
export function GridPanel({
    label,
    className,
    bodyClassName,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement> & { label?: string; bodyClassName?: string }) {
    return (
        <div
            className={cn(
                'relative overflow-hidden rounded border border-primary/30 bg-card/80 backdrop-blur-sm',
                className,
            )}
            {...props}
        >
            <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)]" />

            {label && (
                <div className="relative border-b border-primary/20 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-foreground/50">
                    {label}
                </div>
            )}

            <div className={cn('relative overflow-x-auto', bodyClassName)}>{children}</div>

            <div className="pointer-events-none absolute left-0 top-0 size-3 border-l-2 border-t-2 border-primary/50" />
            <div className="pointer-events-none absolute right-0 top-0 size-3 border-r-2 border-t-2 border-primary/50" />
            <div className="pointer-events-none absolute bottom-0 left-0 size-3 border-b-2 border-l-2 border-primary/50" />
            <div className="pointer-events-none absolute bottom-0 right-0 size-3 border-b-2 border-r-2 border-primary/50" />
        </div>
    );
}
