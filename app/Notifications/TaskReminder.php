<?php

namespace App\Notifications;

use App\Models\Task;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskReminder extends Notification
{
    public function __construct(public Task $task) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject('Reminder: '.$this->task->title)
            ->greeting('Reminder')
            ->line($this->task->title);

        if ($this->task->due_at) {
            $mail->line('Due: '.$this->task->due_at->toDayDateTimeString());
        }

        return $mail->action('Open your tasks', url('/tasks'));
    }
}
