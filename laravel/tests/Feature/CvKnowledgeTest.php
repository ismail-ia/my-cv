<?php

namespace Tests\Feature;

use App\AI\Agents\Avatar;
use App\AI\Knowledge\CvKnowledge;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Guards the promise the site makes to visitors: the avatar answers only from
 * the CV. If the grounding text stops reaching the prompt, the model falls back
 * on its own priors and starts inventing a career.
 */
class CvKnowledgeTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        if ((glob(resource_path('cv').'/*.md') ?: []) === []) {
            $this->markTestSkipped(
                'resources/cv is empty. It is populated by docker COPY (prod) or the dev bind mount of /CV.'
            );
        }
    }

    #[Test]
    public function it_loads_the_cv_and_ignores_the_directory_readme(): void
    {
        $markdown = app(CvKnowledge::class)->markdown();

        $this->assertStringContainsString('ISMAIL IBRAHIM', $markdown);
        $this->assertStringNotContainsString('single source of truth', $markdown);
    }

    #[Test]
    public function the_agent_prompt_carries_the_cv_and_its_grounding_rules(): void
    {
        $prompt = (string) Avatar::make()->instructions();

        // A few load-bearing facts the site's own copy also displays.
        foreach (['100.96M', '$47.5M', 'Eve', 'GrintaHub'] as $fact) {
            $this->assertStringContainsString($fact, $prompt, "the prompt lost [{$fact}]");
        }

        $this->assertStringContainsString('Every factual claim you make must come from the CV', $prompt);

        // The fallback address is configuration, not a literal in the prompt.
        $this->assertStringContainsString((string) config('profile.email'), $prompt);
        $this->assertStringContainsString((string) config('profile.name'), $prompt);
    }

    #[Test]
    public function the_cv_is_cached_so_every_message_does_not_hit_the_disk(): void
    {
        $cv = app(CvKnowledge::class);

        $this->assertSame($cv->markdown(), $cv->markdown());
        $this->assertSame(12, strlen($cv->fingerprint()));
    }
}
