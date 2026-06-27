<?php

namespace App\Http\Controllers;

use App\Models\TrashedItem;
use App\Services\TrashManager;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Recycle bin management. Restricted to the `delete-files` permission
 * (whoever can delete can manage the bin) — see route middleware.
 */
class TrashController extends Controller
{
    public function __construct(private readonly TrashManager $trash) {}

    public function index(Request $request): Response
    {
        $items = TrashedItem::where('deleted_by', $request->user()->id)
            ->latest()
            ->get()
            ->map(fn (TrashedItem $item) => [
                'id' => $item->id,
                'name' => $item->name,
                'original_path' => $item->original_path,
                'type' => $item->type,
                'size' => $item->size,
                'deleted_at' => $item->created_at?->toDateTimeString(),
            ]);

        return Inertia::render('trash/index', ['items' => $items]);
    }

    public function restore(Request $request, TrashedItem $trashedItem): RedirectResponse
    {
        $this->authorizeOwner($request, $trashedItem);

        Audit::log('restored', "Restored “{$trashedItem->original_path}”");
        $this->trash->restore($trashedItem);

        return back()->with('success', 'Restored.');
    }

    public function destroy(Request $request, TrashedItem $trashedItem): RedirectResponse
    {
        $this->authorizeOwner($request, $trashedItem);

        Audit::log('purged', "Permanently deleted “{$trashedItem->original_path}”");
        $this->trash->purge($trashedItem);

        return back()->with('success', 'Permanently deleted.');
    }

    public function empty(Request $request): RedirectResponse
    {
        $count = $this->trash->emptyAll($request->user()->id);
        Audit::log('emptied-trash', "Emptied trash ({$count} item(s))");

        return back()->with('success', "Emptied trash ({$count} item(s)).");
    }

    /** Only the user who trashed an item may restore or purge it. */
    private function authorizeOwner(Request $request, TrashedItem $item): void
    {
        abort_unless($item->deleted_by === $request->user()->id, 403);
    }
}
