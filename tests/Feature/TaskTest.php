<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\User;
use App\Notifications\TaskReminder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class TaskTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_user_can_create_and_see_their_tasks(): void
    {
        $u = User::factory()->create();

        $this->actingAs($u)->post('/tasks', ['title' => 'Buy milk', 'priority' => 'high'])->assertRedirect();
        $this->assertDatabaseHas('tasks', ['user_id' => $u->id, 'title' => 'Buy milk', 'priority' => 'high']);

        $this->actingAs($u)->get('/tasks')->assertOk();
    }

    public function test_tasks_are_scoped_per_user(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();
        $task = Task::create(['user_id' => $alice->id, 'title' => 'Alice only']);

        $this->actingAs($bob)->patch("/tasks/{$task->id}", ['title' => 'hacked'])->assertForbidden();
        $this->actingAs($bob)->delete("/tasks/{$task->id}")->assertForbidden();
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'title' => 'Alice only']);
    }

    public function test_toggling_done_sets_and_clears_completed_at(): void
    {
        $u = User::factory()->create();
        $task = Task::create(['user_id' => $u->id, 'title' => 'x']);

        $this->actingAs($u)->patch("/tasks/{$task->id}", ['done' => true]);
        $this->assertNotNull($task->fresh()->completed_at);

        $this->actingAs($u)->patch("/tasks/{$task->id}", ['done' => false]);
        $this->assertNull($task->fresh()->completed_at);
    }

    public function test_a_user_can_delete_their_task(): void
    {
        $u = User::factory()->create();
        $task = Task::create(['user_id' => $u->id, 'title' => 'x']);

        $this->actingAs($u)->delete("/tasks/{$task->id}")->assertRedirect();
        $this->assertDatabaseMissing('tasks', ['id' => $task->id]);
    }

    public function test_reminder_command_emails_due_reminders_once(): void
    {
        Notification::fake();
        $u = User::factory()->create();

        $due = Task::create(['user_id' => $u->id, 'title' => 'due', 'remind_at' => now()->subMinute()]);
        Task::create(['user_id' => $u->id, 'title' => 'future', 'remind_at' => now()->addDay()]);
        Task::create(['user_id' => $u->id, 'title' => 'done', 'remind_at' => now()->subMinute(), 'completed_at' => now()]);
        Task::create(['user_id' => $u->id, 'title' => 'already', 'remind_at' => now()->subMinute(), 'notified_at' => now()]);

        $this->artisan('tasks:remind')->assertSuccessful();

        Notification::assertSentTo($u, TaskReminder::class, fn ($n) => $n->task->id === $due->id);
        Notification::assertSentTimes(TaskReminder::class, 1);
        $this->assertNotNull($due->fresh()->notified_at);
    }
}
