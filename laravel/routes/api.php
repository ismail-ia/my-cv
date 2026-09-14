<?php

use App\Http\Controllers\ChatController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

/*
 * The avatar chat is unauthenticated and costs money per request, so both
 * endpoints are throttled by IP. Opening sessions is cheap and gets a looser
 * limit than sending messages, which each fan out to an LLM call.
 */
Route::prefix('chat')->group(function (): void {
    Route::post('/session', [ChatController::class, 'session'])
        ->middleware('throttle:chat-session')
        ->name('chat.session');

    Route::post('/', [ChatController::class, 'store'])
        ->middleware('throttle:chat-message')
        ->name('chat.store');
});
