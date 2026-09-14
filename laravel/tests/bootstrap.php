<?php

/**
 * Test bootstrap.
 *
 * Every container in this project is configured by environment variables that
 * docker compose exports, which means the live dev stack's settings are present
 * in $_SERVER for the whole test run. Laravel's Env repository reads $_SERVER
 * before anything else, so phpunit.xml's <env> entries lose - even with
 * force="true" - and the suite silently runs against the real Redis, the real
 * queue and the real SQLite file. RefreshDatabase then drops those tables.
 *
 * Collision's `artisan test` normally prevents this by reading laravel/.env and
 * clearing every name it finds, but that only works when the file exists, and
 * it does nothing for a bare `vendor/bin/phpunit` run.
 *
 * So the <php><env> block in phpunit.xml is applied here, explicitly, before
 * the framework boots. phpunit.xml stays the single place those values live.
 */

declare(strict_types=1);

require_once __DIR__.'/../vendor/autoload.php';

$configuration = __DIR__.'/../phpunit.xml';

if (is_file($configuration)) {
    $xml = simplexml_load_file($configuration);

    foreach ($xml?->php?->env ?? [] as $env) {
        $name = (string) $env['name'];
        $value = (string) $env['value'];

        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
        putenv($name.'='.$value);
    }
}
