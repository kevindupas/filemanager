<?php

namespace App\Http\Controllers;

use App\Models\TrashedItem;
use App\Services\TrashManager;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Recycle bin management. Restricted to the `delete-files` permission
 * (whoever can delete can manage the bin) — see route middleware.
 */
class TrashController extends Controller
{
    public function __construct(private readonly TrashManager $trash) {}

    public function index(): Response
    {
        $items = TrashedItem::latest()->get()->map(fn (TrashedItem $item) => [
            'id' => $item->id,
            'name' => $item->name,
            'original_path' => $item->original_path,
            'type' => $item->type,
            'size' => $item->size,
            'deleted_at' => $item->created_at?->toDateTimeString(),
        ]);

        return Inertia::render('trash/index', ['items' => $items]);
    }

    public function restore(TrashedItem $trashedItem): RedirectResponse
    {
        Audit::log('restored', "Restored “{$trashedItem->original_path}”");
        $this->trash->restore($trashedItem);

        return back()->with('success', 'Restored.');
    }

    public function destroy(TrashedItem $trashedItem): RedirectResponse
    {
        Audit::log('purged', "Permanently deleted “{$trashedItem->original_path}”");
        $this->trash->purge($trashedItem);

        return back()->with('success', 'Permanently deleted.');
    }

    public function empty(): RedirectResponse
    {
        $count = $this->trash->emptyAll();
        Audit::log('emptied-trash', "Emptied trash ({$count} item(s))");

        return back()->with('success', "Emptied trash ({$count} item(s)).");
    }
}
