<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

/**
 * Audit trail of file/share/user actions. Admin only (manage-users).
 */
class ActivityController extends Controller
{
    public function index(): Response
    {
        $activities = Activity::with('causer')
            ->latest()
            ->limit(200)
            ->get()
            ->map(fn (Activity $a) => [
                'id' => $a->id,
                'event' => $a->event,
                'description' => $a->description,
                'causer' => $a->causer?->name ?? 'system',
                'properties' => $a->properties,
                'created_at' => $a->created_at?->toDateTimeString(),
            ]);

        return Inertia::render('activity/index', ['activities' => $activities]);
    }
}
