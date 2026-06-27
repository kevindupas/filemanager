<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

/**
 * Simple key/value settings store. Reads are cached; writes bust the cache.
 */
class Setting extends Model
{
    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['key', 'value'];

    private static function cacheKey(string $key): string
    {
        return 'setting:'.$key;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $value = Cache::rememberForever(self::cacheKey($key), fn () => self::query()->find($key)?->value);

        return $value ?? $default;
    }

    public static function put(string $key, mixed $value): void
    {
        self::query()->updateOrCreate(['key' => $key], ['value' => (string) $value]);
        Cache::forget(self::cacheKey($key));
    }

    public static function forget(string $key): void
    {
        self::query()->where('key', $key)->delete();
        Cache::forget(self::cacheKey($key));
    }

    /**
     * True once the install wizard has completed — or if the instance already
     * has at least one account (legacy installs created before the wizard).
     * Tolerates an unmigrated database (returns false so the wizard shows and
     * reports the missing migrations).
     */
    public static function installed(): bool
    {
        try {
            if (! Schema::hasTable('settings')) {
                return false;
            }
            if (self::get('installed_at') !== null) {
                return true;
            }

            return Schema::hasTable('users') && User::exists();
        } catch (\Throwable) {
            return false;
        }
    }
}
