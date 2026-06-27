<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Personal to-do list (per user). Optional due date + one-shot email reminder.
 */
class TaskController extends Controller
{
    public function index(Request $request): Response
    {
        $tasks = Task::where('user_id', $request->user()->id)
            ->orderByRaw('CASE WHEN completed_at IS NULL THEN 0 ELSE 1 END') // open first
            ->orderByRaw('due_at IS NULL')                                   // dated first
            ->orderBy('due_at')
            ->orderByDesc('id')
            ->get()
            ->map($this->present(...));

        return Inertia::render('tasks/index', ['tasks' => $tasks]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateTask($request);
        Task::create([...$data, 'user_id' => $request->user()->id]);
        Audit::log('task-created', "Added task “{$data['title']}”");

        return back()->with('success', 'Task added.');
    }

    public function update(Request $request, Task $task): RedirectResponse
    {
        $this->authorizeOwner($request, $task);
        $data = $this->validateTask($request, partial: true);

        // A reminder that moved into the future should fire again.
        if (array_key_exists('remind_at', $data) && $data['remind_at'] !== $task->remind_at?->toIso8601String()) {
            $data['notified_at'] = null;
        }
        if ($request->has('done')) {
            $data['completed_at'] = $request->boolean('done') ? now() : null;
        }

        $task->update($data);

        return back()->with('success', 'Task updated.');
    }

    public function destroy(Request $request, Task $task): RedirectResponse
    {
        $this->authorizeOwner($request, $task);
        $task->delete();

        return back()->with('success', 'Task deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateTask(Request $request, bool $partial = false): array
    {
        $rules = [
            'title' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'priority' => ['nullable', 'in:low,normal,high'],
            'due_at' => ['nullable', 'date'],
            'remind_at' => ['nullable', 'date'],
        ];

        return $request->validate($rules);
    }

    private function authorizeOwner(Request $request, Task $task): void
    {
        abort_unless($task->user_id === $request->user()->id, 403);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Task $task): array
    {
        return [
            'id' => $task->id,
            'title' => $task->title,
            'description' => $task->description,
            'priority' => $task->priority,
            'due_at' => $task->due_at?->toIso8601String(),
            'remind_at' => $task->remind_at?->toIso8601String(),
            'done' => $task->isDone(),
            'completed_at' => $task->completed_at?->toDateTimeString(),
        ];
    }
}
