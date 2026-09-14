<?php

namespace Tests\Feature;

use App\AI\Agents\Avatar;
use App\AI\Knowledge\CvKnowledge;
use App\Services\ChatService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Support\RecordingBroadcaster;
use Tests\TestCase;

class AvatarChatTest extends TestCase
{
    use RefreshDatabase;

    private RecordingBroadcaster $broadcaster;

    protected function setUp(): void
    {
        parent::setUp();

        $this->broadcaster = new RecordingBroadcaster;

        // Bound to a local, not $this: BroadcastManager rebinds custom creator
        // closures to itself, so $this->broadcaster would resolve against the
        // manager instead of the test case.
        $broadcaster = $this->broadcaster;

        Broadcast::extend('recording', fn (): RecordingBroadcaster => $broadcaster);

        config([
            'broadcasting.default' => 'recording',
            'broadcasting.connections.recording' => ['driver' => 'recording'],
        ]);

        // resources/cv is populated from /CV by docker COPY or the dev bind
        // mount, so it is not guaranteed to exist on a bare checkout. The agent's grounding is
        // asserted separately, in CvKnowledgeTest.
        config([
            'profile.name' => 'Test Person',
            'profile.first_name' => 'Test',
            'profile.email' => 'test@example.com',
        ]);

        $this->app->instance(CvKnowledge::class, new class extends CvKnowledge
        {
            public function __construct() {}

            public function markdown(): string
            {
                return '# TEST CV';
            }

            public function fingerprint(): string
            {
                return 'testtesttest';
            }
        });
    }

    #[Test]
    public function opening_a_session_returns_a_channel_the_client_can_subscribe_to(): void
    {
        $response = $this->postJson('/api/chat/session');

        $response->assertOk()
            ->assertJsonStructure(['chat_id', 'channel', 'events' => ['delta', 'done', 'failed']]);

        $chatId = $response->json('chat_id');

        $this->assertTrue(Str::isUuid($chatId));
        $this->assertSame('chat.'.$chatId, $response->json('channel'));
    }

    #[Test]
    public function a_message_cannot_be_queued_for_a_session_the_server_never_issued(): void
    {
        $this->postJson('/api/chat', [
            'chat_id' => (string) Str::uuid(),
            'message' => 'Why keep the monolith?',
        ])->assertStatus(410);
    }

    #[Test]
    public function it_rejects_a_message_that_is_missing_or_too_long(): void
    {
        $chatId = $this->postJson('/api/chat/session')->json('chat_id');

        $this->postJson('/api/chat', ['chat_id' => $chatId])
            ->assertStatus(422)
            ->assertJsonValidationErrors('message');

        $this->postJson('/api/chat', ['chat_id' => $chatId, 'message' => str_repeat('a', 501)])
            ->assertStatus(422)
            ->assertJsonValidationErrors('message');
    }

    #[Test]
    public function a_valid_message_is_accepted_and_queued(): void
    {
        $chatId = $this->postJson('/api/chat/session')->json('chat_id');

        $this->postJson('/api/chat', ['chat_id' => $chatId, 'message' => 'Are you available?'])
            ->assertStatus(202)
            ->assertJson(['status' => 'queued', 'chat_id' => $chatId]);
    }

    #[Test]
    public function it_streams_the_answer_as_coalesced_deltas_then_a_done_event(): void
    {
        $answer = 'I kept the monolith and distributed the infrastructure under it instead.';

        Avatar::fake([$answer]);

        app(ChatService::class)->processMessage('abc-123', 'Why keep the monolith?');

        $deltas = $this->broadcaster->ofType(ChatService::EVENT_DELTA);

        $this->assertNotEmpty($deltas, 'the answer should reach the browser as deltas');
        $this->assertSame($answer, $this->broadcaster->textOf(ChatService::EVENT_DELTA));
        $this->assertSame(['chat.abc-123'], $deltas[0]['channels']);

        $done = $this->broadcaster->ofType(ChatService::EVENT_DONE);
        $this->assertCount(1, $done, 'exactly one terminal event');
        $this->assertSame([], $this->broadcaster->ofType(ChatService::EVENT_FAILED));

        // The whole point of the buffer: the browser gets far fewer messages
        // than the model produced tokens.
        $this->assertLessThan(
            (int) ceil(mb_strlen($answer) / 8),
            count($deltas),
            'deltas should be coalesced, not forwarded one token at a time',
        );
    }

    #[Test]
    public function a_failing_agent_tells_the_browser_instead_of_leaving_it_hanging(): void
    {
        Avatar::fake(function (): never {
            throw new \RuntimeException('provider exploded');
        });

        app(ChatService::class)->processMessage('abc-123', 'Why keep the monolith?');

        $failed = $this->broadcaster->ofType(ChatService::EVENT_FAILED);

        $this->assertCount(1, $failed);
        $this->assertSame(['chat.abc-123'], $failed[0]['channels']);
        $this->assertStringContainsString('test@example.com', $failed[0]['payload']['message']);
        $this->assertSame([], $this->broadcaster->ofType(ChatService::EVENT_DONE));
    }
}
