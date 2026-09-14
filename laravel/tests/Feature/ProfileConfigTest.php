<?php

namespace Tests\Feature;

use App\AI\Agents\Avatar;
use App\AI\Agents\FollowUpQuestions;
use App\AI\Knowledge\CvKnowledge;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * The person the site is about is configuration. If a name or address is ever
 * hardcoded back into a prompt, changing the config silently stops changing
 * what the avatar says - and it would keep handing out the wrong email.
 */
class ProfileConfigTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'profile.name' => 'Ada Lovelace',
            'profile.first_name' => 'Ada',
            'profile.email' => 'ada@example.com',
        ]);

        $this->app->instance(CvKnowledge::class, new class extends CvKnowledge
        {
            public function __construct() {}

            public function markdown(): string
            {
                return '# TEST CV';
            }
        });
    }

    #[Test]
    public function the_avatar_prompt_is_built_from_config(): void
    {
        $prompt = (string) Avatar::make()->instructions();

        $this->assertStringContainsString('Ada Lovelace', $prompt);
        $this->assertStringContainsString('ada@example.com', $prompt);
        $this->assertStringNotContainsString('Ismail', $prompt);
        $this->assertStringNotContainsString('ismail.ibrahim', $prompt);
    }

    #[Test]
    public function the_follow_up_prompt_is_built_from_config(): void
    {
        $prompt = (string) FollowUpQuestions::make()->instructions();

        $this->assertStringContainsString('Ada Lovelace', $prompt);
        $this->assertStringContainsString('Ada', $prompt);
        $this->assertStringNotContainsString('Ismail', $prompt);
    }

    #[Test]
    public function the_follow_up_prompt_excludes_what_the_avatar_refuses(): void
    {
        // The two agents have to agree: Avatar deflects negotiation questions to
        // email, so suggesting one produces a chip that cannot be satisfied.
        $prompt = (string) FollowUpQuestions::make()->instructions();

        foreach (['salary', 'notice period', 'references'] as $topic) {
            $this->assertStringContainsString($topic, $prompt, "the exclusion list lost [{$topic}]");
        }
    }

    #[Test]
    public function first_name_is_derived_from_the_full_name(): void
    {
        // Reload the config file itself rather than the values set in setUp.
        $config = require config_path('profile.php');

        $this->assertSame('Ismail', $config['first_name'], 'the default should split the default name');
    }
}
