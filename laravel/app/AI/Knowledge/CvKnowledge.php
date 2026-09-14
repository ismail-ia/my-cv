<?php

namespace App\AI\Knowledge;

use Illuminate\Contracts\Cache\Repository as Cache;
use RuntimeException;

/**
 * The Avatar agent's single source of factual truth.
 *
 * The markdown comes from /CV: baked in with COPY for production images and
 * bind-mounted read-only in dev. It is small enough (~1,400 words) to sit in
 * the system prompt whole, which is both cheaper and far more faithful than
 * chunk-and-retrieve at this size: the model sees every claim, so it cannot
 * answer from a chunk that happened to miss the relevant bullet.
 */
class CvKnowledge
{
    private const CACHE_PREFIX = 'cv.knowledge.v2.';

    private const CACHE_TTL = 3600;

    private readonly string $path;

    public function __construct(
        private readonly Cache $cache,
        ?string $path = null,
    ) {
        $this->path = $path ?? resource_path('cv');
    }

    public function markdown(): string
    {
        $files = $this->files();

        return $this->cache->remember(
            self::CACHE_PREFIX.$this->revision($files),
            self::CACHE_TTL,
            fn (): string => $this->read($files),
        );
    }

    /**
     * Identifies the revision of the CV currently on disk.
     *
     * This is deliberately computed from the files, not from the cached text:
     * a fingerprint that reports what the cache happens to hold is worse than
     * none at all when you are chasing a wrong answer in the logs.
     */
    public function fingerprint(): string
    {
        return $this->revision($this->files());
    }

    /**
     * @return list<string>
     */
    private function files(): array
    {
        // Octane keeps workers resident for thousands of requests, so PHP's
        // stat cache would otherwise hide any edit made after the worker booted.
        clearstatcache();

        $files = array_values(array_filter(
            glob($this->path.'/*.md') ?: [],
            // CV/README.md documents how the directory is wired up; it is not
            // CV content, and in dev the whole directory is mounted as-is.
            static fn (string $file): bool => strcasecmp(basename($file), 'README.md') !== 0,
        ));

        if ($files === []) {
            throw new RuntimeException(
                "No CV markdown in {$this->path}. It is populated from /CV by docker COPY in the production image, and by a read-only bind mount in dev."
            );
        }

        sort($files);

        return $files;
    }

    /**
     * The cache key is derived from this, so editing the CV invalidates the
     * cached copy on the very next message instead of an hour later. Three stat
     * calls are nothing next to the LLM round trip they precede.
     *
     * @param  list<string>  $files
     */
    private function revision(array $files): string
    {
        $signature = implode('|', array_map(
            static fn (string $file): string => $file.':'.filemtime($file).':'.filesize($file),
            $files,
        ));

        return substr(hash('xxh128', $signature), 0, 12);
    }

    /**
     * @param  list<string>  $files
     */
    private function read(array $files): string
    {
        return trim(implode("\n\n---\n\n", array_map(
            static fn (string $file): string => trim((string) file_get_contents($file)),
            $files,
        )));
    }
}
