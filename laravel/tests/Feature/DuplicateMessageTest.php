<?php

namespace Tests\Feature;

use App\Chat\DuplicateMessageGuard;
use App\Jobs\ProcessIncomingChat;
use App\Services\Contracts\ChatServiceInterface;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DuplicateMessageTest extends TestCase
{
    private function openSession(): string
    {
        return $this->postJson('/api/chat/session')->json('chat_id');
    }

    #[Test]
    public function the_same_question_is_queued_once_and_reported_as_a_duplicate(): void
    {
        Queue::fake();

        $chatId = $this->openSession();
        $payload = ['chat_id' => $chatId, 'message' => 'Why keep the monolith?'];

        $this->postJson('/api/chat', $payload)
            ->assertStatus(202)
            ->assertJson(['status' => 'queued']);

        $this->postJson('/api/chat', $payload)
            ->assertOk()
            ->assertJson(['status' => 'duplicate'])
            // The browser needs something to show in place of the line it drew.
            ->assertJsonStructure(['status', 'chat_id', 'message']);

        Queue::assertPushed(ProcessIncomingChat::class, 1);
    }

    #[Test]
    public function normalisation_means_casing_and_spacing_do_not_dodge_the_gate(): void
    {
        Queue::fake();

        $chatId = $this->openSession();

        $this->postJson('/api/chat', ['chat_id' => $chatId, 'message' => 'Why keep the monolith?'])
            ->assertStatus(202);

        foreach ([
            'why keep the monolith?',
            '  Why keep the monolith?  ',
            "Why   keep\tthe monolith?",
        ] as $variant) {
            $this->postJson('/api/chat', ['chat_id' => $chatId, 'message' => $variant])
                ->assertOk()
                ->assertJson(['status' => 'duplicate']);
        }

        Queue::assertPushed(ProcessIncomingChat::class, 1);
    }

    #[Test]
    public function a_different_question_in_the_same_chat_is_still_queued(): void
    {
        Queue::fake();

        $chatId = $this->openSession();

        $this->postJson('/api/chat', ['chat_id' => $chatId, 'message' => 'Why keep the monolith?'])->assertStatus(202);
        $this->postJson('/api/chat', ['chat_id' => $chatId, 'message' => 'Tell me about Eve'])->assertStatus(202);

        Queue::assertPushed(ProcessIncomingChat::class, 2);
    }

    #[Test]
    public function the_same_question_from_a_different_visitor_is_not_a_duplicate(): void
    {
        Queue::fake();

        $first = $this->openSession();
        $second = $this->openSession();

        $this->postJson('/api/chat', ['chat_id' => $first, 'message' => 'Are you available?'])->assertStatus(202);
        $this->postJson('/api/chat', ['chat_id' => $second, 'message' => 'Are you available?'])->assertStatus(202);

        Queue::assertPushed(ProcessIncomingChat::class, 2);
    }

    #[Test]
    public function finishing_the_job_releases_the_claim_immediately(): void
    {
        // The lease is a crash backstop. In the normal case the job hands the
        // question back as soon as the answer is delivered, so a visitor who
        // reads the reply and asks again gets an answer, not a duplicate notice.
        $this->app->bind(ChatServiceInterface::class, fn () => new class implements ChatServiceInterface
        {
            public function processMessage(string $chatId, string $message): void {}
        });

        $chatId = (string) Str::uuid();
        $guard = app(DuplicateMessageGuard::class);

        $this->assertTrue($guard->claim($chatId, 'Why keep the monolith?'));
        $this->assertFalse($guard->claim($chatId, 'Why keep the monolith?'), 'still in flight');

        app()->call([new ProcessIncomingChat($chatId, 'Why keep the monolith?'), 'handle']);

        $this->assertTrue(
            $guard->claim($chatId, 'Why keep the monolith?'),
            'the claim should be released the moment the answer is delivered',
        );
    }

    #[Test]
    public function a_failed_answer_still_releases_the_claim(): void
    {
        // A failure the visitor can see is a finished exchange. Holding the
        // claim would block the retry they are about to make by hand.
        $this->app->bind(ChatServiceInterface::class, fn () => new class implements ChatServiceInterface
        {
            public function processMessage(string $chatId, string $message): void
            {
                throw new \RuntimeException('provider exploded');
            }
        });

        $chatId = (string) Str::uuid();
        $guard = app(DuplicateMessageGuard::class);

        $this->assertTrue($guard->claim($chatId, 'Why keep the monolith?'));

        try {
            app()->call([new ProcessIncomingChat($chatId, 'Why keep the monolith?'), 'handle']);
        } catch (\RuntimeException) {
            // expected - ChatService normally swallows this, but the release
            // must survive the case where it does not.
        }

        $this->assertTrue($guard->claim($chatId, 'Why keep the monolith?'));
    }

    #[Test]
    public function the_lease_outlives_the_job_timeout(): void
    {
        // If the lease were shorter, a slow but healthy answer would have its
        // claim expire mid-stream and a resend would start a second stream into
        // the same channel.
        $job = new ProcessIncomingChat((string) Str::uuid(), 'Why keep the monolith?');

        $this->assertGreaterThan(
            $job->timeout,
            DuplicateMessageGuard::LEASE_SECONDS,
            'the lease must outlast the longest a job can legitimately run',
        );
    }

    #[Test]
    public function an_abandoned_claim_expires_so_a_crash_cannot_wedge_a_question(): void
    {
        Queue::fake();

        $chatId = $this->openSession();
        $payload = ['chat_id' => $chatId, 'message' => 'Why keep the monolith?'];

        $this->postJson('/api/chat', $payload)->assertStatus(202);
        $this->postJson('/api/chat', $payload)->assertOk()->assertJson(['status' => 'duplicate']);

        $this->travel(DuplicateMessageGuard::LEASE_SECONDS + 1)->seconds();

        $this->postJson('/api/chat', $payload)->assertStatus(202)->assertJson(['status' => 'queued']);

        Queue::assertPushed(ProcessIncomingChat::class, 2);
    }

    #[Test]
    public function should_be_unique_drops_a_repeat_dispatched_outside_the_controller(): void
    {
        // The controller gate cannot cover a dispatch from tinker, a scheduled
        // replay, or a second app instance. ShouldBeUnique does, and this is
        // the half that proves it - not just that uniqueId() is configured.
        Queue::fake();

        $chatId = (string) Str::uuid();

        ProcessIncomingChat::dispatch($chatId, 'Why keep the monolith?');
        ProcessIncomingChat::dispatch($chatId, 'Why keep the monolith?');
        ProcessIncomingChat::dispatch($chatId, '  why   KEEP the monolith?  ');

        Queue::assertPushed(ProcessIncomingChat::class, 1);

        // A different question still gets through, so the lock is scoped to the
        // message and not to the chat.
        ProcessIncomingChat::dispatch($chatId, 'Tell me about Eve');

        Queue::assertPushed(ProcessIncomingChat::class, 2);
    }

    #[Test]
    public function the_job_and_the_gate_agree_on_what_the_same_message_means(): void
    {
        // If these ever diverge, the controller queues a job the queue then
        // silently drops, and the browser waits for a stream that never starts.
        $chatId = (string) Str::uuid();

        $job = new ProcessIncomingChat($chatId, '  Why   KEEP the monolith? ');

        $this->assertSame(
            DuplicateMessageGuard::fingerprint($chatId, 'why keep the monolith?'),
            $job->uniqueId(),
        );

        $this->assertSame(DuplicateMessageGuard::LEASE_SECONDS, $job->uniqueFor);
    }
}
