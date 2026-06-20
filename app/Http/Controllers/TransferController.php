<?php

namespace App\Http\Controllers;

use App\Models\Transfer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Read-only progress feed for the background transfers tray (per user).
 */
class TransferController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $transfers = Transfer::where('user_id', $request->user()->id)
            ->where(function ($q) {
                $q->whereIn('status', ['queued', 'running'])
                    ->orWhere('updated_at', '>=', now()->subMinutes(10));
            })
            ->latest()
            ->limit(20)
            ->get()
            ->map(function (Transfer $t) {
                // Overlay live progress from the cache (Redis) while running.
                $live = $t->status === 'running' ? Cache::get("transfer:{$t->id}") : null;
                $doneBytes = (int) ($live['done_bytes'] ?? $t->done_bytes);
                $doneFiles = (int) ($live['done_files'] ?? $t->done_files);
                $current = $live['current'] ?? $t->current;

                return [
                    'id' => $t->id,
                    'mode' => $t->mode,
                    'source' => $t->source_disk,
                    'dest' => $t->dest_disk,
                    'destination' => $t->destination,
                    'status' => $t->status,
                    'total_bytes' => (int) $t->total_bytes,
                    'done_bytes' => $doneBytes,
                    'total_files' => (int) $t->total_files,
                    'done_files' => $doneFiles,
                    'current' => $current ? basename($current) : null,
                    'error' => $t->error,
                ];
            });

        return response()->json($transfers);
    }

    /** Clear finished/failed rows (housekeeping for the tray). */
    public function clear(Request $request): JsonResponse
    {
        Transfer::where('user_id', $request->user()->id)
            ->whereIn('status', ['done', 'failed'])
            ->delete();

        return response()->json(['ok' => true]);
    }

    /** Dismiss a single transfer (any status — also kills a stuck/queued one). */
    public function destroy(Request $request, Transfer $transfer): JsonResponse
    {
        abort_unless($transfer->user_id === $request->user()->id, 403);
        Cache::forget("transfer:{$transfer->id}");
        $transfer->delete();

        return response()->json(['ok' => true]);
    }
}
