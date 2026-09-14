<?php

namespace App\Providers;

use App\Services\ChatService;
use App\Services\Contracts\ChatServiceInterface;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(ChatServiceInterface::class, ChatService::class);
    }

    public function boot(): void
    {
        $this->configureRateLimiting();
    }

    /**
     * The avatar chat is anonymous and every message costs an LLM call, so the
     * limits are per IP and deliberately tight. A human asking questions never
     * gets near them; a script scraping the agent hits them in seconds.
     */
    private function configureRateLimiting(): void
    {
        RateLimiter::for('chat-session', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));

        RateLimiter::for('chat-message', fn (Request $request) => [
            Limit::perMinute(8)->by($request->ip()),
            Limit::perDay(120)->by($request->ip()),
        ]);
    }
}
