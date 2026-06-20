<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Connection extends Model
{
    protected $fillable = ['user_id', 'name', 'type', 'config'];

    protected $hidden = ['config'];

    protected function casts(): array
    {
        return [
            'config' => 'encrypted:array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Stable disk key used in ?disk= and the UI. */
    public function diskKey(): string
    {
        return 'conn_'.$this->id;
    }
}
