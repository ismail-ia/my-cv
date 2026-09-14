<?php

namespace App\Support;

use Closure;

/**
 * Coalesces token deltas into fewer, larger broadcasts.
 *
 * Sockudo's own append rollup lives behind `ai_transport`, which requires a
 * durable shared version store (postgres/mysql/dynamodb - memory and redis are
 * both rejected). Rather than take on a database for it, the same job is done
 * here: one HTTP publish per flush instead of one per token.
 *
 * A 250-word answer is roughly 350 deltas. At a 60ms window that becomes about
 * 25 publishes, and the reader still sees text appear continuously - 60ms is
 * below the ~100ms threshold where interface response stops feeling immediate.
 */
class StreamDeltaBuffer
{
    private string $buffer = '';

    private ?float $openedAt = null;

    /**
     * @param  Closure(string): void  $flush
     * @param  int  $windowMs  Max time a fragment waits before being sent.
     * @param  int  $maxChars  Hard size cap, so a fast provider cannot build
     *                         one oversized frame between time-based flushes.
     */
    public function __construct(
        private readonly Closure $flush,
        private readonly int $windowMs = 60,
        private readonly int $maxChars = 240,
    ) {}

    public function push(string $delta): void
    {
        if ($delta === '') {
            return;
        }

        $this->openedAt ??= microtime(true);
        $this->buffer .= $delta;

        if ($this->shouldFlush()) {
            $this->flushNow();
        }
    }

    /**
     * Always call this when the stream ends, or the trailing fragment - which
     * is usually the end of the last sentence - is never delivered.
     */
    public function flushNow(): void
    {
        $this->openedAt = null;
        if ($this->buffer === '') {
            return;
        }

        $payload = $this->buffer;

        $this->buffer = '';
        ($this->flush)($payload);
    }

    private function shouldFlush(): bool
    {
        if (mb_strlen($this->buffer) >= $this->maxChars) {
            return true;
        }

        return (microtime(true) - $this->openedAt) * 1000 >= $this->windowMs;
    }
}
