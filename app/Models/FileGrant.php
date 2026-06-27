<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FileGrant extends Model
{
    protected $fillable = [
        'owner_id',
        'grantee_id',
        'path',
        'permission',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function grantee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'grantee_id');
    }

    public function canWrite(): bool
    {
        return $this->permission === 'write';
    }
}
