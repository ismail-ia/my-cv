<?php

namespace App\Chat;

use Illuminate\Contracts\Cache\Repository as Cache;

/**
 * Stops the same question being answered twice.
 *
 * A visitor who double-clicks a suggestion chip, hits enter twice, or retries
 * on a flaky connection sends the identical message two or three times within a
 * second. Each one is a paid LLM call and a second stream into the same
 * channel, where the two answers interleave into nonsense.
 *
 * The gate is Cache::add() - SET NX EX on Redis - so the check and the claim are
 * one atomic round trip. A read-then-write (`has()` then `put()`) would leave a
 * window between them, and with two php-fpm workers handling two clicks that
 * window is exactly where both requests decide they are the first.
 */
class DuplicateMessageGuard
{
    /**
     * How long a claim survives without anyone releasing it.
     *
     * This is a lease, not the normal lifetime: the job releases its claim the
     * moment the answer is delivered, so in the ordinary case the question
     * becomes askable again as soon as it has been answered. A visitor who
     * reads a reply and wants it again should not be told to wait.
     *
     * The TTL only matters when nothing gets to release it - the worker is
     * SIGKILLed, the container dies mid-answer, Redis loses the release. It
     * must therefore comfortably exceed ProcessIncomingChat::$timeout (180s),
     * or a slow-but-healthy answer would have its claim expire underneath it
     * and a resend would start a second stream into the same channel.
     * DuplicateMessageTest asserts that ordering.
     */
    public const LEASE_SECONDS = 300;

    private const PREFIX = 'chat:message:';

    public function __construct(private readonly Cache $cache) {}

    /**
     * Claim this message for this chat.
     *
     * @return bool true when the caller is the first to claim it and should do
     *              the work; false when it is a repeat that should be ignored.
     */
    public function claim(string $chatId, string $message): bool
    {
        return $this->cache->add(
            self::PREFIX.self::fingerprint($chatId, $message),
            true,
            self::LEASE_SECONDS,
        );
    }

    /**
     * Release a claim once the work behind it is finished.
     *
     * Called by the job rather than the controller: the controller only knows
     * the request was accepted, and the claim has to stand for as long as the
     * answer is actually being produced. Forgetting a key that is already gone
     * is a no-op, so this is safe to call more than once.
     */
    public function release(string $chatId, string $message): void
    {
        $this->cache->forget(self::PREFIX.self::fingerprint($chatId, $message));
    }

    /**
     * A stable identity for "this question, in this conversation".
     *
     * Static and pure so the queue job can derive the same value without
     * resolving anything from the container - the job's uniqueId() and this
     * gate must never disagree about what counts as the same message.
     *
     * Normalising means "Why keep the monolith?" and "why keep the monolith?"
     * are one question: a visitor retyping rather than re-clicking is still
     * asking the same thing, and the model would return the same answer.
     */
    public static function fingerprint(string $chatId, string $message): string
    {
        $normalised = mb_strtolower(trim((string) preg_replace('/\s+/u', ' ', $message)));

        return $chatId.':'.hash('xxh128', $normalised);
    }
}
