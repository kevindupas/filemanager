<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transfer extends Model
{
    protected $fillable = [
        'user_id', 'mode', 'source_disk', 'dest_disk', 'destination', 'paths', 'resolutions',
        'status', 'total_bytes', 'done_bytes', 'total_files', 'done_files', 'current', 'error',
    ];

    protected function casts(): array
    {
        return ['paths' => 'array', 'resolutions' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
