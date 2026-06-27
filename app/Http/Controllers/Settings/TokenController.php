<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\ApiToken;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Personal access token management (REST API + WebDAV). The plaintext token is
 * shown once, right after creation, via a one-time flash.
 */
class TokenController extends Controller
{
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/tokens', [
            'tokens' => ApiToken::where('user_id', $request->user()->id)
                ->latest()
                ->get()
                ->map(fn (ApiToken $t) => [
                    'id' => $t->id,
                    'name' => $t->name,
                    'last_used_at' => $t->last_used_at?->toDateTimeString(),
                    'created_at' => $t->created_at?->toDateTimeString(),
                ]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:255']]);

        [, $plain] = ApiToken::issue($request->user(), $data['name']);

        return back()->with('token', $plain)->with('success', 'Token created — copy it now, it won’t be shown again.');
    }

    public function destroy(Request $request, ApiToken $token): RedirectResponse
    {
        abort_unless($token->user_id === $request->user()->id, 403);

        $token->delete();

        return back()->with('success', 'Token revoked.');
    }
}
