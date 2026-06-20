<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrashedItem extends Model
{
    protected $fillable = [
        'original_path',
        'name',
        'type',
        'size',
        'storage_key',
        'deleted_by',
    ];

    public function deleter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }
}
