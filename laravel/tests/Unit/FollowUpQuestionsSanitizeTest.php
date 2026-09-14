<?php

namespace Tests\Unit;

use App\AI\Agents\FollowUpQuestions;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * Structured output guarantees the shape of the response, not its contents.
 * These chips are rendered as buttons, so whatever survives here goes straight
 * into the UI.
 */
class FollowUpQuestionsSanitizeTest extends TestCase
{
    #[Test]
    public function it_keeps_well_formed_questions_in_order(): void
    {
        $this->assertSame(
            ['How did you handle the race conditions?', 'What broke during the AWS move?'],
            FollowUpQuestions::sanitize([
                'How did you handle the race conditions?',
                'What broke during the AWS move?',
            ]),
        );
    }

    #[Test]
    public function it_keeps_a_realistic_length_question(): void
    {
        // Measured against live output: follow-ups land around 30-50 chars.
        $realistic = "What's your approach to third-party integrations?";

        $this->assertSame([$realistic], FollowUpQuestions::sanitize([$realistic]));
    }

    #[Test]
    public function it_drops_questions_too_long_for_a_chip(): void
    {
        $this->assertSame(
            ['Short enough'],
            FollowUpQuestions::sanitize([
                'Short enough',
                str_repeat('a', FollowUpQuestions::MAX_LENGTH + 1),
            ]),
        );
    }

    #[Test]
    public function it_collapses_whitespace_and_drops_empties(): void
    {
        $this->assertSame(
            ['What is Eve?'],
            FollowUpQuestions::sanitize(["  What   is\nEve?  ", '', '   ']),
        );
    }

    #[Test]
    public function it_removes_case_insensitive_duplicates(): void
    {
        $this->assertSame(
            ['Tell me about Eve'],
            FollowUpQuestions::sanitize(['Tell me about Eve', 'tell me about eve']),
        );
    }

    #[Test]
    public function it_never_returns_more_than_the_chip_row_holds(): void
    {
        $this->assertCount(
            FollowUpQuestions::COUNT,
            FollowUpQuestions::sanitize(['one', 'two', 'three', 'four', 'five']),
        );
    }

    #[Test]
    public function it_tolerates_anything_that_is_not_a_list_of_strings(): void
    {
        $this->assertSame([], FollowUpQuestions::sanitize(null));
        $this->assertSame([], FollowUpQuestions::sanitize('not an array'));
        $this->assertSame(['ok'], FollowUpQuestions::sanitize(['ok', 42, null, ['nested']]));
    }
}
