<?php

namespace App\Jobs;

use App\Chat\DuplicateMessageGuard;
use App\Services\Contracts\ChatServiceInterface;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ProcessIncomingChat implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    /**
     * One attempt only. ChatService already catches its own failures and tells
     * the browser, and a retry would re-run a paid LLM call and replay deltas
     * into a channel that has already rendered part of an answer.
     */
    public int $tries = 1;

    public int $timeout = 180;

    /**
     * The queue-level half of the idempotency guarantee.
     *
     * DuplicateMessageGuard already stops the controller queueing a repeat, and
     * it has to, because only the controller can tell the browser what
     * happened. This covers everything that does not come through the
     * controller - a replay from tinker, a future admin re-run, a second
     * app instance - where a silent drop is exactly the right behaviour.
     *
     * Both halves derive their key from the same pure function, so they cannot
     * disagree about what "the same message" means, and uniqueFor matches the
     * gate's window so one lock cannot outlive the other.
     */
    public int $uniqueFor = DuplicateMessageGuard::LEASE_SECONDS;

    public function __construct(
        public readonly string $chatId,
        public readonly string $message,
    ) {}

    public function uniqueId(): string
    {
        return DuplicateMessageGuard::fingerprint($this->chatId, $this->message);
    }

    public function handle(ChatServiceInterface $chatService, DuplicateMessageGuard $guard): void
    {
        try {
            $chatService->processMessage($this->chatId, $this->message);
        } finally {
            // The claim exists to mean "this question is being answered right
            // now". Once the answer is on the wire that is no longer true, so
            // it is released here rather than left to expire - a visitor who
            // reads the reply and asks the same thing again should get an
            // answer, not a duplicate notice.
            //
            // finally, not after the call: a failed answer is still a finished
            // one, and holding the claim would block the retry the visitor is
            // about to make by hand.
            $guard->release($this->chatId, $this->message);
        }
    }

    /**
     * Covers the paths that never reach handle() - a job that fails to
     * unserialise, or one the worker gives up on before invoking it. Releasing
     * twice is harmless; leaving a claim stranded is not.
     */
    public function failed(?Throwable $exception): void
    {
        app(DuplicateMessageGuard::class)->release($this->chatId, $this->message);
    }
}
