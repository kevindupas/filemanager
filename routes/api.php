<?php

use App\Http\Controllers\Api\FileApiController;
use App\Http\Controllers\WebDavController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Token-authenticated REST API (Bearer). Prefixed with /api by the framework.
Route::middleware('token')->prefix('v1')->group(function () {
    Route::get('user', fn (Request $request) => $request->user()->only(['id', 'name', 'email']));

    Route::get('files', [FileApiController::class, 'index']);
    Route::get('files/download', [FileApiController::class, 'download']);
    Route::post('files', [FileApiController::class, 'store']);
    Route::delete('files', [FileApiController::class, 'destroy']);
});

// WebDAV (HTTP Basic with a token as the password). Mountable at /api/webdav.
Route::middleware('token:basic')->match(
    ['OPTIONS', 'GET', 'HEAD', 'PUT', 'DELETE', 'PROPFIND', 'MKCOL', 'MOVE'],
    'webdav/{path?}',
    [WebDavController::class, 'handle'],
)->where('path', '.*');
