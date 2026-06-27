<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ApiToken extends Model
{
    protected $fillable = ['user_id', 'name', 'token', 'last_used_at'];

    protected $hidden = ['token'];

    protected function casts(): array
    {
        return ['last_used_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function hashFor(string $plain): string
    {
        return hash('sha256', $plain);
    }

    /**
     * Create a token for a user, returning [model, plaintext]. The plaintext is
     * only available here — we persist its hash.
     *
     * @return array{0: self, 1: string}
     */
    public static function issue(User $user, string $name): array
    {
        $plain = Str::random(48);
        $token = static::create([
            'user_id' => $user->id,
            'name' => $name,
            'token' => static::hashFor($plain),
        ]);

        return [$token, $plain];
    }
}
