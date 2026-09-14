<?php

namespace App\Http\Controllers;

use App\Chat\DuplicateMessageGuard;
use App\Jobs\ProcessIncomingChat;
use App\Services\ChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class ChatController extends Controller
{
    /**
     * How long an idle chat session stays valid. Long enough that a visitor can
     * read an answer and follow up, short enough that abandoned ids expire.
     */
    private const SESSION_TTL = 3600;

    /**
     * Open a chat session.
     *
     * The channel name is issued here rather than chosen by the client for two
     * reasons: the client cannot pick a name that collides with someone else's
     * stream, and the browser gets to subscribe *before* any message is queued.
     * Without that ordering the worker can publish the first deltas into a
     * channel nobody is listening on yet, and the answer starts mid-sentence.
     */
    public function session(): JsonResponse
    {
        $chatId = (string) Str::uuid();

        Cache::put($this->sessionKey($chatId), true, self::SESSION_TTL);

        return response()->json([
            'chat_id' => $chatId,
            'channel' => 'chat.'.$chatId,
            'events' => [
                'delta' => ChatService::EVENT_DELTA,
                'done' => ChatService::EVENT_DONE,
                'failed' => ChatService::EVENT_FAILED,
                'suggestions' => ChatService::EVENT_SUGGESTIONS,
            ],
        ]);
    }

    /**
     * Queue a visitor's message for the Avatar agent.
     */
    public function store(Request $request, DuplicateMessageGuard $guard): JsonResponse
    {
        $validated = $request->validate([
            'chat_id' => ['required', 'string', 'uuid'],
            'message' => ['required', 'string', 'min:2', 'max:500'],
        ]);

        // An unknown or expired id means the caller never opened a session, so
        // it is trying to publish into a channel it does not own.
        if (! Cache::has($this->sessionKey($validated['chat_id']))) {
            return response()->json([
                'message' => 'That chat session has expired. Reload the page and ask again.',
            ], 410);
        }

        // Renew session TTL on message push
        Cache::put($this->sessionKey($validated['chat_id']), true, self::SESSION_TTL);

        // 200, not 409: nothing went wrong. The request was understood and the
        // desired state - "this question is being answered" - already holds, so
        // the honest reply is success plus a note that there was nothing new to
        // do. The browser uses it to drop the message it optimistically drew.
        if (! $guard->claim($validated['chat_id'], $validated['message'])) {
            return response()->json([
                'status' => 'duplicate',
                'chat_id' => $validated['chat_id'],
                'message' => 'You just asked that - I am already working on it.',
            ]);
        }

        ProcessIncomingChat::dispatch($validated['chat_id'], $validated['message']);

        return response()->json([
            'status' => 'queued',
            'chat_id' => $validated['chat_id'],
        ], 202);
    }

    private function sessionKey(string $chatId): string
    {
        return 'chat:session:'.$chatId;
    }
}
