<?php

use App\Http\Controllers\ActivityController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\ConnectionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FavoriteController;
use App\Http\Controllers\FileController;
use App\Http\Controllers\InstallController;
use App\Http\Controllers\NoteController;
use App\Http\Controllers\PublicShareController;
use App\Http\Controllers\ShareController;
use App\Http\Controllers\SharedController;
use App\Http\Controllers\TransferController;
use App\Http\Controllers\TrashController;
use App\Http\Controllers\UserShareController;
use App\Services\DiskResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// First-run install wizard (no auth). The EnsureInstalled middleware keeps
// everything else redirected here until it completes, then locks it.
Route::get('install', [InstallController::class, 'show'])->name('install.show');
Route::post('install', [InstallController::class, 'store'])->name('install.store');

// Public share access (no auth) — rate-limited.
Route::middleware('throttle:60,1')->group(function () {
    Route::get('s/{token}', [PublicShareController::class, 'show'])->name('share.show');
    Route::post('s/{token}/unlock', [PublicShareController::class, 'unlock'])->name('share.unlock');
    Route::get('s/{token}/download', [PublicShareController::class, 'download'])->name('share.download');
    Route::get('s/{token}/preview', [PublicShareController::class, 'preview'])->name('share.preview');
});

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // File browser — list + download are open to any authenticated user.
    Route::get('files', [FileController::class, 'index'])->name('files.index');
    Route::get('files/list', [FileController::class, 'list'])->name('files.list');
    Route::get('files/download', [FileController::class, 'download'])->name('files.download');

    // Dual-pane commander (cross-disk transfers via drag & drop).
    Route::get('commander', function (Request $request) {
        return Inertia::render('commander', [
            'disks' => app(DiskResolver::class)->available($request->user()),
            'can' => [
                'delete' => $request->user()->can('delete-files'),
                'createFolders' => $request->user()->can('create-folders'),
            ],
        ]);
    })->name('commander');
    Route::get('files/zip', [FileController::class, 'zip'])->name('files.zip');
    Route::get('files/preview', [FileController::class, 'preview'])->name('files.preview');
    Route::get('files/thumb', [FileController::class, 'thumb'])->name('files.thumb');
    Route::get('files/info', [FileController::class, 'info'])->name('files.info');
    Route::get('files/dirs', [FileController::class, 'dirs'])->name('files.dirs');

    // Move/copy are open to any authenticated user (consistent with rename).
    Route::post('files/transfer/check', [FileController::class, 'checkTransfer'])->name('files.transfer.check');
    Route::post('files/move', [FileController::class, 'move'])->name('files.move');
    Route::post('files/copy', [FileController::class, 'copy'])->name('files.copy');

    // Background transfer progress (polled by the transfers tray).
    Route::get('transfers', [TransferController::class, 'index'])->name('transfers.index');
    Route::delete('transfers', [TransferController::class, 'clear'])->name('transfers.clear');
    Route::delete('transfers/{transfer}', [TransferController::class, 'destroy'])->name('transfers.destroy');

    // Sensitive/destructive operations are gated by permission.
    Route::post('files/folders', [FileController::class, 'storeFolder'])
        ->middleware('permission:create-folders')->name('files.folders.store');
    Route::post('files/upload', [FileController::class, 'upload'])
        ->middleware('permission:upload-files')->name('files.upload');
    Route::post('files/rename', [FileController::class, 'rename'])->name('files.rename');
    Route::post('files/save', [FileController::class, 'save'])
        ->middleware('permission:upload-files')->name('files.save');

    // Encrypted notes — per user, body encrypted at rest.
    Route::get('notes', [NoteController::class, 'index'])->name('notes.index');
    Route::post('notes', [NoteController::class, 'store'])->name('notes.store');
    Route::patch('notes/{note}', [NoteController::class, 'update'])->name('notes.update');
    Route::delete('notes/{note}', [NoteController::class, 'destroy'])->name('notes.destroy');

    // Favorites — open to any authenticated user.
    Route::get('favorites', [FavoriteController::class, 'index'])->name('favorites.index');
    Route::post('favorites/toggle', [FavoriteController::class, 'toggle'])->name('favorites.toggle');

    // Remote storage connections (per-user, SFTP/FTP/S3).
    Route::get('connections', [ConnectionController::class, 'index'])->name('connections.index');
    Route::post('connections', [ConnectionController::class, 'store'])->name('connections.store');
    Route::post('connections/test', [ConnectionController::class, 'test'])->name('connections.test');
    Route::get('connections/{connection}/health', [ConnectionController::class, 'health'])->name('connections.health');
    Route::put('connections/{connection}', [ConnectionController::class, 'update'])->name('connections.update');
    Route::delete('connections/{connection}', [ConnectionController::class, 'destroy'])->name('connections.destroy');
    Route::delete('files', [FileController::class, 'destroy'])
        ->middleware('permission:delete-files')->name('files.destroy');

    // Recycle bin — whoever can delete can manage the bin.
    Route::middleware('permission:delete-files')->group(function () {
        Route::get('trash', [TrashController::class, 'index'])->name('trash.index');
        Route::post('trash/{trashedItem}/restore', [TrashController::class, 'restore'])->name('trash.restore');
        Route::delete('trash/{trashedItem}', [TrashController::class, 'destroy'])->name('trash.destroy');
        Route::delete('trash', [TrashController::class, 'empty'])->name('trash.empty');
    });

    // Share links management (creating public links is gated).
    Route::middleware('permission:share-files')->group(function () {
        Route::get('shares', [ShareController::class, 'index'])->name('shares.index');
        Route::get('shares/for', [ShareController::class, 'forPath'])->name('shares.for');
        Route::post('shares', [ShareController::class, 'store'])->name('shares.store');
        Route::delete('shares/{share}', [ShareController::class, 'destroy'])->name('shares.destroy');

        // Account-to-account shares (internal). Owner-side management.
        Route::get('shares/users', [UserShareController::class, 'forPath'])->name('shares.users.for');
        Route::post('shares/users', [UserShareController::class, 'store'])->name('shares.users.store');
        Route::delete('shares/users/{grant}', [UserShareController::class, 'destroy'])->name('shares.users.destroy');
    });

    // Shared with me (internal grants) — read access, confined to the grant.
    Route::get('shared', [SharedController::class, 'index'])->name('shared.index');
    Route::get('shared/{grant}/list', [SharedController::class, 'list'])->name('shared.list');
    Route::get('shared/{grant}/info', [SharedController::class, 'info'])->name('shared.info');
    Route::get('shared/{grant}/download', [SharedController::class, 'download'])->name('shared.download');
    Route::get('shared/{grant}/preview', [SharedController::class, 'preview'])->name('shared.preview');
    // Writes — only honoured for write grants (checked in the controller).
    Route::post('shared/{grant}/folders', [SharedController::class, 'storeFolder'])->name('shared.folders');
    Route::post('shared/{grant}/upload', [SharedController::class, 'upload'])->name('shared.upload');
    Route::post('shared/{grant}/rename', [SharedController::class, 'rename'])->name('shared.rename');
    Route::delete('shared/{grant}', [SharedController::class, 'destroy'])->name('shared.destroy');

    // Per-file comments (owner + grantees of the path).
    Route::get('comments', [CommentController::class, 'index'])->name('comments.index');
    Route::post('comments', [CommentController::class, 'store'])->name('comments.store');
    Route::delete('comments/{comment}', [CommentController::class, 'destroy'])->name('comments.destroy');

    // Activity feed — open to any authenticated user (scoped to themselves);
    // admins can widen to everyone via ?scope=all.
    Route::get('activity', [ActivityController::class, 'index'])->name('activity.index');

    // Account administration — admin only (manage-users permission).
    Route::middleware('permission:manage-users')->group(function () {
        Route::get('admin/users', [UserController::class, 'index'])->name('admin.users.index');
        Route::post('admin/users', [UserController::class, 'store'])->name('admin.users.store');
        Route::put('admin/users/{user}', [UserController::class, 'update'])->name('admin.users.update');
        Route::delete('admin/users/{user}', [UserController::class, 'destroy'])->name('admin.users.destroy');
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
