<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\FileManager;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(private readonly FileManager $files) {}

    public function index(Request $request): Response
    {
        $stats = $this->files->stats();
        $quotaBytes = (int) round(config('filemanager.quota_gb') * 1024 ** 3);

        return Inertia::render('dashboard', [
            'stats' => $stats,
            'userCount' => $request->user()->can('manage-users') ? User::count() : null,
            'quota' => [
                'used' => $stats['bytes'],
                'limit' => $quotaBytes,
                'percent' => $quotaBytes > 0 ? min(100, round($stats['bytes'] / $quotaBytes * 100)) : 0,
            ],
        ]);
    }
}
