# syntax=docker/dockerfile:1.7
#
# Build context is the repository root (see docker-compose.yml), so this file
# can reach both ./laravel (application) and ./docker/php (runtime assets).

# =============================================================================
# base - shared runtime: extensions, composer, unprivileged user
# =============================================================================
FROM php:8.4-cli-alpine AS base

ENV COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_NO_INTERACTION=1 \
    COMPOSER_HOME=/tmp/composer

# Build deps go into a virtual package so they can be dropped in the same layer,
# keeping the compiler toolchain out of the final image.
RUN set -eux; \
    apk add --no-cache ca-certificates curl git unzip tini libzip; \
    apk add --no-cache --virtual .build-deps $PHPIZE_DEPS linux-headers libzip-dev; \
    docker-php-ext-install -j"$(nproc)" pcntl sockets opcache zip; \
    pecl install redis; \
    docker-php-ext-enable redis; \
    pecl clear-cache; \
    apk del .build-deps; \
    rm -rf /tmp/pear /var/cache/apk/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY docker/php/php.ini /usr/local/etc/php/conf.d/90-app.ini
COPY docker/php/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

# uid/gid 1000 matches the typical Linux desktop user, so bind-mounted source in
# the dev stage stays writable without chowning the host tree.
RUN addgroup -g 1000 app && adduser -u 1000 -G app -h /home/app -s /bin/sh -D app

WORKDIR /var/www/html

# SQLite lives on a named volume outside the app tree so php and php-worker
# share one database file and image rebuilds never destroy it.
RUN mkdir -p /var/www/data && chown app:app /var/www/data
VOLUME /var/www/data

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint"]

# =============================================================================
# vendor - composer install, cached on the lockfile alone
# =============================================================================
FROM base AS vendor

COPY laravel/composer.json laravel/composer.lock ./
# --no-scripts: artisan is not present yet. Autoloader is dumped after the app
# source lands, in the build stage below.
RUN --mount=type=cache,target=/tmp/composer/cache \
    composer install --no-dev --no-scripts --no-autoloader --prefer-dist

# =============================================================================
# vendor-dev - same install with require-dev, for the dev image
# =============================================================================
FROM base AS vendor-dev

COPY laravel/composer.json laravel/composer.lock ./
# The autoloader IS generated here (unlike the prod vendor stage): the dev
# image has no app source of its own, so it cannot dump one later.
RUN --mount=type=cache,target=/tmp/composer/cache \
    composer install --no-scripts --prefer-dist \
    && chown -R app:app /var/www/html/vendor

# =============================================================================
# build - full app + optimized autoloader + roadrunner binary
# =============================================================================
FROM vendor AS build

COPY laravel/ ./
# The CV is authored once in /CV and copied straight into the image. Syncing it
# into laravel/resources/cv and committing that would put a generated file in
# git and give the agent a second copy of the facts to drift from.
COPY CV/*.md ./resources/cv/
RUN set -eux; \
    composer dump-autoload --optimize --classmap-authoritative --no-dev; \
    php artisan package:discover --ansi; \
    ./vendor/bin/rr get-binary --location /var/www/html; \
    chmod +x /var/www/html/rr

# =============================================================================
# prod - runtime image, no composer cache, non-root
# =============================================================================
FROM base AS prod

ENV APP_ENV=production \
    OCTANE_SERVER=roadrunner

COPY --from=build --chown=app:app /var/www/html /var/www/html
COPY --chown=app:app docker/php/.rr.yaml /var/www/html/.rr.yaml

# storage/ and bootstrap/cache must be writable at runtime; everything else stays
# read-only-by-ownership to keep the blast radius small.
RUN set -eux; \
    mkdir -p storage/framework/cache/data storage/framework/sessions \
             storage/framework/views storage/app/private storage/logs \
             bootstrap/cache; \
    chown -R app:app storage bootstrap/cache; \
    chmod -R u+rwX storage bootstrap/cache

USER app

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/up || exit 1

CMD ["php", "artisan", "octane:start", "--server=roadrunner", "--host=0.0.0.0", "--port=8000"]

# =============================================================================
# dev - source is bind-mounted; deps are installed by the entrypoint
# =============================================================================
FROM base AS dev

ENV APP_ENV=local \
    OCTANE_SERVER=roadrunner

COPY docker/php/php-dev.ini /usr/local/etc/php/conf.d/99-dev.ini
COPY --chown=app:app docker/php/.rr.yaml /var/www/html/.rr.yaml

# octane:start --watch shells out to vendor/laravel/octane/bin/file-watcher.cjs,
# which require()s chokidar. Install it globally and expose it via NODE_PATH so
# the watcher resolves it regardless of the app's own node_modules.
ENV NODE_PATH=/usr/local/lib/node_modules

RUN apk add --no-cache nodejs npm bash \
    && npm install -g --no-fund --no-audit chokidar@^4 \
    && npm cache clean --force \
    && mkdir -p /tmp/composer \
    && chown -R app:app /tmp/composer /var/www/html

# Docker seeds a named volume from the image path it covers, so shipping a
# populated, app-owned vendor/ here means the volume arrives ready to use.
COPY --from=vendor-dev --chown=app:app /var/www/html/vendor /var/www/html/vendor

USER app

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --start-period=120s --retries=5 \
    CMD curl -fsS http://127.0.0.1:8000/up || exit 1

# Verified: Octane's chokidar watcher picks up edits through the bind mount in
# ~5s with plain inotify. If you run this on a host filesystem where it does
# not (some network / virtiofs mounts), append --poll.
CMD ["php", "artisan", "octane:start", "--server=roadrunner", "--host=0.0.0.0", "--port=8000", "--watch"]
