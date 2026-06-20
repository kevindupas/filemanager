import { GridPanel } from '@/components/grid-panel';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { formatBytes } from '@/lib/format';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { File, Folder, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface TrashItem {
    id: number;
    name: string;
    original_path: string;
    type: 'dir' | 'file';
    size: number | null;
    deleted_at: string | null;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Trash', href: '/trash' }];

export default function Trash({ items }: { items: TrashItem[] }) {
    const [emptyOpen, setEmptyOpen] = useState(false);

    const restore = (id: number) => router.post(route('trash.restore', id), {}, { preserveScroll: true });
    const purge = (id: number) => router.delete(route('trash.destroy', id), { preserveScroll: true });
    const emptyAll = () =>
        router.delete(route('trash.empty'), { preserveScroll: true, onFinish: () => setEmptyOpen(false) });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Trash" />

            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
                <div className="flex shrink-0 items-center justify-between">
                    <h1 className="font-mono text-lg uppercase tracking-widest text-primary glow-text">Recycle bin</h1>
                    {items.length > 0 && (
                        <Button variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={() => setEmptyOpen(true)}>
                            <Trash2 className="size-4" />
                            Empty trash
                        </Button>
                    )}
                </div>

                <GridPanel label="RECYCLE BIN" className="flex min-h-0 flex-1 flex-col" bodyClassName="min-h-0 flex-1 overflow-auto">
                    <div className="min-w-[40rem]">
                        <div className="sticky top-0 z-10 grid grid-cols-[1fr_8rem_12rem_8rem] items-center gap-2 border-b border-primary/20 bg-card/95 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-foreground/40 backdrop-blur-sm">
                            <span>Original location</span>
                            <span className="text-right">Size</span>
                            <span className="text-right">Deleted</span>
                            <span></span>
                        </div>
                        {items.length === 0 ? (
                            <div className="px-4 py-16 text-center text-sm text-muted-foreground">Trash is empty.</div>
                        ) : (
                            items.map((item, i) => (
                                <div
                                    key={item.id}
                                    className={`grid grid-cols-[1fr_8rem_12rem_8rem] items-center gap-2 border-b border-primary/10 px-4 py-2.5 text-xs transition-colors last:border-0 hover:bg-primary/5 ${
                                        i % 2 === 1 ? 'bg-foreground/[0.02]' : ''
                                    }`}
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        {item.type === 'dir' ? (
                                            <Folder className="size-5 shrink-0 text-primary glow-text" />
                                        ) : (
                                            <File className="size-5 shrink-0 text-muted-foreground" />
                                        )}
                                        <span className="truncate">{item.original_path}</span>
                                    </div>
                                    <span className="text-right text-muted-foreground">{formatBytes(item.size)}</span>
                                    <span className="text-right text-muted-foreground">{item.deleted_at ?? '—'}</span>
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="size-8" title="Restore" onClick={() => restore(item.id)}>
                                            <RotateCcw className="size-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-8 text-destructive hover:text-destructive"
                                            title="Delete permanently"
                                            onClick={() => purge(item.id)}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </GridPanel>
            </div>

            <Dialog open={emptyOpen} onOpenChange={setEmptyOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-mono uppercase tracking-widest">Empty trash</DialogTitle>
                        <DialogDescription>
                            Permanently delete all {items.length} item(s) in the trash? This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEmptyOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={emptyAll}>
                            Empty
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
