<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FileVersion extends Model
{
    protected $fillable = [
        'owner_id',
        'path',
        'storage_key',
        'size',
    ];

    protected function casts(): array
    {
        return ['size' => 'integer'];
    }
}
