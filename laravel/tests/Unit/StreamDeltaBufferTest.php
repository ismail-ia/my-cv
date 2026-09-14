<?php

namespace Tests\Unit;

use App\Support\StreamDeltaBuffer;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class StreamDeltaBufferTest extends TestCase
{
    #[Test]
    public function it_coalesces_many_small_deltas_into_far_fewer_flushes(): void
    {
        $flushes = [];
        // A wide window and a large cap mean only the explicit flush fires.
        $buffer = new StreamDeltaBuffer(function (string $text) use (&$flushes): void {
            $flushes[] = $text;
        }, windowMs: 10_000, maxChars: 10_000);

        foreach (str_split('the quick brown fox jumps over the lazy dog', 2) as $chunk) {
            $buffer->push($chunk);
        }

        $this->assertSame([], $flushes, 'nothing should be published before the window closes');

        $buffer->flushNow();

        $this->assertSame(['the quick brown fox jumps over the lazy dog'], $flushes);
    }

    #[Test]
    public function it_flushes_once_the_character_cap_is_reached(): void
    {
        $flushes = [];
        $buffer = new StreamDeltaBuffer(function (string $text) use (&$flushes): void {
            $flushes[] = $text;
        }, windowMs: 10_000, maxChars: 10);

        $buffer->push('12345');
        $this->assertCount(0, $flushes);

        $buffer->push('67890');
        $this->assertSame(['1234567890'], $flushes, 'the cap should force a flush without waiting');
    }

    #[Test]
    public function it_flushes_once_the_time_window_has_elapsed(): void
    {
        $flushes = [];
        $buffer = new StreamDeltaBuffer(function (string $text) use (&$flushes): void {
            $flushes[] = $text;
        }, windowMs: 20, maxChars: 10_000);

        $buffer->push('first');
        $this->assertCount(0, $flushes);

        usleep(30_000);

        $buffer->push(' second');
        $this->assertSame(['first second'], $flushes);
    }

    #[Test]
    public function it_never_loses_the_trailing_fragment(): void
    {
        $flushes = [];
        $buffer = new StreamDeltaBuffer(function (string $text) use (&$flushes): void {
            $flushes[] = $text;
        }, windowMs: 5, maxChars: 8);

        foreach (['Deploys take around ', '3 seconds', '.'] as $chunk) {
            $buffer->push($chunk);
        }

        $buffer->flushNow();

        $this->assertSame('Deploys take around 3 seconds.', implode('', $flushes));
    }

    #[Test]
    public function flushing_an_empty_buffer_publishes_nothing(): void
    {
        $flushes = [];
        $buffer = new StreamDeltaBuffer(function (string $text) use (&$flushes): void {
            $flushes[] = $text;
        });

        $buffer->push('');
        $buffer->flushNow();
        $buffer->flushNow();

        $this->assertSame([], $flushes);
    }

    #[Test]
    public function it_counts_multibyte_characters_not_bytes(): void
    {
        $flushes = [];
        // 4 multibyte characters is under the cap; 4 bytes would not be.
        $buffer = new StreamDeltaBuffer(function (string $text) use (&$flushes): void {
            $flushes[] = $text;
        }, windowMs: 10_000, maxChars: 6);

        $buffer->push('café');

        $this->assertSame([], $flushes);
    }
}
