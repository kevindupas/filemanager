<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Note extends Model
{
    protected $fillable = ['user_id', 'body', 'pinned'];

    protected function casts(): array
    {
        return [
            // AES-256-GCM with APP_KEY — a raw DB dump is unreadable.
            'body' => 'encrypted',
            'pinned' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
