<?php

namespace App\Services;

use App\AI\Agents\Avatar;
use App\AI\Agents\FollowUpQuestions;
use App\Support\StreamDeltaBuffer;
use App\Services\Contracts\ChatServiceInterface;
use Illuminate\Broadcasting\Channel;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Log;
use Laravel\Ai\Streaming\Events\Error;
use Laravel\Ai\Streaming\Events\StreamEnd;
use Laravel\Ai\Streaming\Events\TextDelta;
use Laravel\Ai\Streaming\Events\ToolCall;
use Laravel\Ai\Streaming\Events\ToolResult;
use Throwable;

/**
 * Runs the Avatar agent and streams its answer to one browser over Sockudo.
 *
 * The wire protocol is deliberately small and stable - three events - rather
 * than a pass-through of the SDK's internal stream events. The browser should
 * not have to care that the agent made a tool call, and a change in the SDK's
 * event vocabulary should not break the front end.
 */
class ChatService implements ChatServiceInterface
{
    public const EVENT_DELTA = 'chat.delta';

    public const EVENT_DONE = 'chat.done';

    public const EVENT_FAILED = 'chat.failed';

    public const EVENT_SUGGESTIONS = 'chat.suggestions';

    /**
     * Not a const: the address comes from config, and this is the one message
     * a visitor sees when everything else has failed - it has to carry a way
     * to reach a human.
     */
    private function fallbackMessage(): string
    {
        $email = (string) config('profile.email');

        return 'Something broke on my side before I could answer that. Try again'
            .($email !== '' ? ", or email me at {$email}." : '.');
    }

    public function processMessage(string $chatId, string $message): void
    {
        $channel = new Channel($this->channelName($chatId));
        $characters = 0;
        $publishes = 0;

        $buffer = new StreamDeltaBuffer(function (string $text) use ($channel, &$publishes): void {
            $publishes++;
            $this->publish($channel, self::EVENT_DELTA, ['delta' => $text]);
        });

        try {
            $stream = Avatar::make()->stream($message);

            foreach ($stream as $event) {
                match (true) {
                    // Tool traffic never reaches the browser. It can carry the
                    // visitor's own contact details, and it is large enough to
                    // run into the socket's per-message limit.
                    $event instanceof ToolCall, $event instanceof ToolResult => null,
                    $event instanceof TextDelta => $this->onDelta($buffer, $event, $characters),
                    $event instanceof Error => throw new \RuntimeException($event->message),
                    default => null,
                };
            }

            $buffer->flushNow();

            $this->publish($channel, self::EVENT_DONE, []);

            Log::info('Avatar answered', [
                'chat_id' => $chatId,
                'characters' => $characters,
                'publishes' => $publishes,
            ]);

            // Deliberately after EVENT_DONE: the visitor is already reading,
            // and fresh chips are worth nothing if they cost a second of
            // silence first.
            $this->publishSuggestions($channel, $chatId, $message, $stream->text ?? '');
        } catch (Throwable $e) {
            // Emit whatever was already buffered first: a half answer the
            // visitor can read beats a truncated one that vanishes.
            $buffer->flushNow();

            Log::error('Avatar failed to answer', [
                'chat_id' => $chatId,
                'exception' => $e
            ]);

            $this->publish($channel, self::EVENT_FAILED, ['message' => $this->fallbackMessage()]);
        }
    }

    /**
     * Refreshes the suggestion chips from what was just discussed.
     *
     * Best effort by design. The answer has already been delivered, so a
     * failure here costs the visitor nothing: the front end simply keeps the
     * chips it is showing. It must never turn a successful answer into a
     * visible error.
     */
    private function publishSuggestions(Channel $channel, string $chatId, string $question, string $answer): void
    {
        if (trim($answer) === '') {
            return;
        }

        try {
            $response = FollowUpQuestions::make()->prompt(
                "The visitor asked:\n{$question}\n\nYou answered:\n{$answer}"
            );

            $questions = FollowUpQuestions::sanitize($response['questions'] ?? null);

            // Keep the existing chips rather than replace three with one.
            if (count($questions) < FollowUpQuestions::MIN_USABLE) {
                Log::info('Skipped chat suggestion refresh, too few usable', [
                    'chat_id' => $chatId,
                    'usable' => count($questions),
                ]);

                return;
            }

            $this->publish($channel, self::EVENT_SUGGESTIONS, ['questions' => $questions]);
        } catch (Throwable $e) {
            Log::warning('Could not refresh chat suggestions', [
                'chat_id' => $chatId,
                'exception' => $e,
            ]);
        }
    }

    private function onDelta(StreamDeltaBuffer $buffer, TextDelta $event, int &$characters): void
    {
        $characters += mb_strlen($event->delta);

        $buffer->push($event->delta);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function publish(Channel $channel, string $event, array $payload): void
    {
        // sendNow(), not send(): these are already running inside a queued job,
        // and ordering is the whole point - a delta that overtakes its
        // predecessor renders the answer scrambled.
        Broadcast::on($channel)->as($event)->with($payload)->sendNow();
    }

    /**
     * Public channel, keyed by a server-generated UUID the visitor never
     * chooses. There is no visitor identity to authenticate against, and the
     * payload is public CV material; an unguessable name is the right amount
     * of protection here, and it keeps /broadcasting/auth off the attack
     * surface entirely.
     */
    private function channelName(string $chatId): string
    {
        return 'chat.'.$chatId;
    }
}
