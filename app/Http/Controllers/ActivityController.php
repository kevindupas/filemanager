<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

/**
 * Activity feed. Every user sees their own actions; admins (manage-users) can
 * widen to everyone with ?scope=all.
 */
class ActivityController extends Controller
{
    public function index(Request $request): Response
    {
        $canViewAll = $request->user()->can('manage-users');
        $global = $canViewAll && $request->query('scope') === 'all';

        $query = Activity::with('causer')->latest()->limit(200);
        if (! $global) {
            $query->causedBy($request->user());
        }

        $activities = $query->get()->map(fn (Activity $a) => [
            'id' => $a->id,
            'event' => $a->event,
            'description' => $a->description,
            'causer' => $a->causer?->name ?? 'system',
            'properties' => $a->properties,
            'created_at' => $a->created_at?->toDateTimeString(),
        ]);

        return Inertia::render('activity/index', [
            'activities' => $activities,
            'canViewAll' => $canViewAll,
            'scope' => $global ? 'all' : 'mine',
        ]);
    }
}
