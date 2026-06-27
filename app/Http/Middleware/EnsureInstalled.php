<?php

namespace App\Http\Middleware;

use App\Models\Setting;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Until the install wizard has run, every web request is funnelled to
 * /install. Once installed, normal routing resumes (the wizard locks itself).
 */
class EnsureInstalled
{
    public function handle(Request $request, Closure $next): Response
    {
        if (Setting::installed() || $request->is('install', 'install/*', 'up')) {
            return $next($request);
        }

        return redirect('/install');
    }
}
