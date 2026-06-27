<?php

namespace App\Console\Commands;

use App\Models\Task;
use App\Notifications\TaskReminder;
use Illuminate\Console\Command;

/**
 * Email reminders for tasks whose remind_at has arrived. Runs every minute
 * (see routes/console.php). Each task is notified once.
 */
class SendTaskReminders extends Command
{
    protected $signature = 'tasks:remind';

    protected $description = 'Send email reminders for due task reminders';

    public function handle(): int
    {
        $due = Task::with('user')
            ->whereNull('completed_at')
            ->whereNull('notified_at')
            ->whereNotNull('remind_at')
            ->where('remind_at', '<=', now())
            ->get();

        foreach ($due as $task) {
            try {
                $task->user?->notify(new TaskReminder($task));
            } catch (\Throwable $e) {
                $this->error("Task {$task->id}: {$e->getMessage()}");
            }
            // Mark notified regardless, so a broken mailer never loops/spams.
            $task->forceFill(['notified_at' => now()])->save();
        }

        $this->info("Processed {$due->count()} reminder(s).");

        return self::SUCCESS;
    }
}
