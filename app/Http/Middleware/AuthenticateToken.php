<?php

namespace App\Http\Middleware;

use App\Models\ApiToken;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authenticate a request by personal access token. Supports a Bearer header
 * (REST API) and HTTP Basic (WebDAV clients), where the token may be the
 * username or the password. Resolves the user onto the default guard so the
 * rest of the app (FileManager, etc.) sees an authenticated user.
 */
class AuthenticateToken
{
    public function handle(Request $request, Closure $next, string $scheme = 'bearer'): Response
    {
        $plain = $this->extract($request, $scheme);

        if ($plain) {
            $token = ApiToken::where('token', ApiToken::hashFor($plain))->first();
            if ($token) {
                $token->forceFill(['last_used_at' => now()])->save();
                Auth::setUser($token->user);

                return $next($request);
            }
        }

        if ($scheme === 'basic') {
            return response('Unauthorized', 401, ['WWW-Authenticate' => 'Basic realm="WebDAV"']);
        }

        return response()->json(['message' => 'Unauthenticated.'], 401);
    }

    private function extract(Request $request, string $scheme): ?string
    {
        if ($scheme === 'basic') {
            // token as password (preferred) or username
            return $request->getPassword() ?: $request->getUser() ?: null;
        }

        return $request->bearerToken();
    }
}
