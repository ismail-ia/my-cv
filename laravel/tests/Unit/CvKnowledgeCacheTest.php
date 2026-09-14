<?php

namespace Tests\Unit;

use App\AI\Knowledge\CvKnowledge;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\Repository;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * The CV is cached, and a cache that cannot tell it went stale is worse than no
 * cache: the avatar keeps quoting a bullet you already rewrote, and nothing in
 * the logs says so.
 */
class CvKnowledgeCacheTest extends TestCase
{
    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();

        $this->dir = sys_get_temp_dir().'/cv-knowledge-'.bin2hex(random_bytes(6));
        mkdir($this->dir);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->dir.'/*') ?: [] as $file) {
            unlink($file);
        }

        rmdir($this->dir);

        parent::tearDown();
    }

    private function knowledge(): CvKnowledge
    {
        return new CvKnowledge(new Repository(new ArrayStore), $this->dir);
    }

    private function write(string $name, string $contents): void
    {
        file_put_contents($this->dir.'/'.$name, $contents);
    }

    #[Test]
    public function it_reads_the_cv_markdown(): void
    {
        $this->write('cv.md', "# ISMAIL IBRAHIM\n\n71.2M requests a month.");

        $this->assertSame("# ISMAIL IBRAHIM\n\n71.2M requests a month.", $this->knowledge()->markdown());
    }

    #[Test]
    public function it_ignores_the_directory_readme(): void
    {
        $this->write('cv.md', '# ISMAIL IBRAHIM');
        $this->write('README.md', '# CV - single source of truth');

        $markdown = $this->knowledge()->markdown();

        $this->assertStringContainsString('ISMAIL IBRAHIM', $markdown);
        $this->assertStringNotContainsString('single source of truth', $markdown);
    }

    #[Test]
    public function editing_the_cv_invalidates_the_cached_copy_immediately(): void
    {
        $this->write('cv.md', 'Deploys take around 3 seconds.');

        $cache = new Repository(new ArrayStore);
        $knowledge = new CvKnowledge($cache, $this->dir);

        $this->assertSame('Deploys take around 3 seconds.', $knowledge->markdown());

        $before = $knowledge->fingerprint();

        // A second granularity on mtime is not enough to detect a fast edit, so
        // the signature also carries the size - which is what changes here.
        $this->write('cv.md', 'Deploys take around 3 seconds, weekly.');

        $this->assertSame('Deploys take around 3 seconds, weekly.', $knowledge->markdown());
        $this->assertNotSame($before, $knowledge->fingerprint());
    }

    #[Test]
    public function the_fingerprint_describes_the_file_not_whatever_the_cache_holds(): void
    {
        $this->write('cv.md', 'original');

        $knowledge = $this->knowledge();
        $knowledge->markdown();

        $original = $knowledge->fingerprint();

        $this->write('cv.md', 'rewritten and longer');

        $this->assertNotSame($original, $knowledge->fingerprint());
        $this->assertSame(12, strlen($knowledge->fingerprint()));
    }

    #[Test]
    public function unchanged_files_are_served_from_cache(): void
    {
        $this->write('cv.md', 'stable content');

        $store = new ArrayStore;
        $knowledge = new CvKnowledge(new Repository($store), $this->dir);

        $knowledge->markdown();

        // Delete the file: a second call that still returns the text can only
        // have come from the cache.
        unlink($this->dir.'/cv.md');
        $this->write('cv.md', 'stable content');

        $this->assertSame('stable content', $knowledge->markdown());
    }

    #[Test]
    public function it_fails_loudly_when_the_directory_has_no_cv(): void
    {
        $this->write('README.md', '# not cv content');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('No CV markdown in');

        $this->knowledge()->markdown();
    }
}
