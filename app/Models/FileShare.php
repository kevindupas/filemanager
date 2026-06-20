<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FileShare extends Model
{
    protected $fillable = [
        'token',
        'path',
        'name',
        'password',
        'expires_at',
        'downloads',
        'last_accessed_at',
        'created_by',
    ];

    protected $hidden = ['password'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'last_accessed_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function hasPassword(): bool
    {
        return $this->password !== null;
    }
}
