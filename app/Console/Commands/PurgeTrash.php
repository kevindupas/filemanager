<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Services\TrashManager;
use Illuminate\Console\Command;

/**
 * Retention policy: permanently delete trashed items older than the configured
 * number of days. Runs daily (see routes/console.php).
 */
class PurgeTrash extends Command
{
    protected $signature = 'trash:purge {--days= : Override the retention window}';

    protected $description = 'Purge trashed items older than the retention window';

    public function handle(TrashManager $trash): int
    {
        $days = $this->option('days') !== null
            ? (int) $this->option('days')
            : (int) (Setting::get('trash_retention_days') ?? config('filemanager.trash_retention_days', 30));

        if ($days <= 0) {
            $this->info('Trash retention disabled (days <= 0); nothing purged.');

            return self::SUCCESS;
        }

        $count = $trash->purgeExpired($days);
        $this->info("Purged {$count} trashed item(s) older than {$days} day(s).");

        return self::SUCCESS;
    }
}
