<?php

namespace App\AI\Agents;

use App\AI\Knowledge\CvKnowledge;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\MaxTokens;
use Laravel\Ai\Attributes\Temperature;
use Laravel\Ai\Attributes\UseCheapestModel;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;
use Stringable;

/**
 * Proposes the next three questions to put in the suggestion chips.
 *
 * This runs after the answer has already been delivered, so it never delays a
 * reply. It is a small, bounded, throwaway call: cheapest model, low token
 * ceiling, structured output so there is nothing to parse defensively.
 *
 * The chips are a promise as much as a prompt - a visitor who clicks one
 * expects an answer, so every suggestion has to be answerable from the CV.
 * That is why the whole CV goes in rather than a topic list.
 */
#[UseCheapestModel]
#[MaxTokens(200)]
#[Temperature(0.4)]
class FollowUpQuestions implements Agent, HasStructuredOutput
{
    use Promptable;

    public const COUNT = 3;

    /**
     * Chips wrap onto their own row past roughly this, which is fine - the row
     * is flex-wrap. Measured against real output: a natural follow-up runs
     * 30-50 characters, so a tighter cap silently threw away most of what the
     * model produced and left a single chip behind.
     */
    public const MAX_LENGTH = 64;

    /**
     * Below this the refresh is skipped entirely and the previous chips stay.
     * One lonely chip where there were three reads as breakage, not as an
     * answer-aware suggestion.
     */
    public const MIN_USABLE = 2;

    public function __construct(private readonly CvKnowledge $cv) {}

    public function instructions(): Stringable|string
    {
        $name = (string) config('profile.name');
        $firstName = (string) config('profile.first_name');

        return <<<PROMPT
        You suggest follow-up questions for the chat on {$name}'s CV website.
        A visitor has just asked something and been answered. Propose the
        {$this->count()} questions they are most likely to want next.

        Rules:
        - Every question must be answerable from the CV below. If it is not in
          the CV, do not suggest it.
        - Write them as the visitor speaking to {$firstName}, in the second
          person: "How did you handle X?", not "How did {$firstName} handle X?".
        - At most {$this->maxLength()} characters each, and aim for well under
          that. They render as small chips; short and specific beats complete.
        - Do not re-ask what was just answered, and do not repeat each other.
          Move the conversation somewhere new.
        - Never suggest salary, rate, notice period, references, or anything
          else that needs a real negotiation. The avatar is instructed to answer
          those with an email address rather than a figure, so suggesting one
          hands the visitor a chip that is guaranteed to disappoint.
        - Prefer the concrete over the general: a specific system, incident,
          number or decision beats "tell me about your experience".
        - No trailing whitespace, no numbering, no quotes around them.

        # CV - the only thing you may draw on

        {$this->cv->markdown()}
        PROMPT;
    }

    /**
     * @return array<string, \Illuminate\JsonSchema\Types\Type>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'questions' => $schema->array()
                ->items($schema->string())
                ->min(self::COUNT)
                ->max(self::COUNT)
                ->required()
                ->description('The follow-up questions, most likely first.'),
        ];
    }

    private function count(): int
    {
        return self::COUNT;
    }

    private function maxLength(): int
    {
        return self::MAX_LENGTH;
    }

    /**
     * Drops anything the model returned that we would not want on a chip.
     *
     * Structured output guarantees the shape, not the contents: an over-long
     * or empty string still arrives as a valid string.
     *
     * @param  mixed  $questions
     * @return list<string>
     */
    public static function sanitize(mixed $questions): array
    {
        if (! is_array($questions)) {
            return [];
        }

        $clean = [];

        foreach ($questions as $question) {
            if (! is_string($question)) {
                continue;
            }

            $question = trim(preg_replace('/\s+/', ' ', $question) ?? '');

            if ($question === '' || mb_strlen($question) > self::MAX_LENGTH) {
                continue;
            }

            // First occurrence wins: the agent returns them most-likely first,
            // so a later near-duplicate should not overwrite the better one.
            $clean[mb_strtolower($question)] ??= $question;
        }

        return array_slice(array_values($clean), 0, self::COUNT);
    }
}
