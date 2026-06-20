<?php

namespace App\Support;

use Illuminate\Support\Facades\Auth;

/**
 * Thin wrapper over spatie/activitylog so controllers log file/share/user
 * actions in one line. Causer is the current authenticated user.
 */
class Audit
{
    /**
     * @param  array<string, mixed>  $properties
     */
    public static function log(string $event, string $description, array $properties = []): void
    {
        activity('filemanager')
            ->causedBy(Auth::user())
            ->event($event)
            ->withProperties($properties)
            ->log($description);
    }
}
