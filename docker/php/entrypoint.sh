#!/bin/sh
# Container entrypoint for both the Octane server and the queue worker.
# Idempotent: safe to run on every start, restart and scale-up.
set -eu

log() { printf '[entrypoint] %s\n' "$*" >&2; }
fail() { printf '[entrypoint] FATAL: %s\n' "$*" >&2; exit 1; }

: "${APP_ENV:=production}"
: "${DB_CONNECTION:=sqlite}"
: "${APP_RUN_MIGRATIONS:=false}"

# ---------------------------------------------------------------------------
# Fail fast on missing configuration rather than 500ing on the first request.
# ---------------------------------------------------------------------------
[ -n "${APP_KEY:-}" ] || fail "APP_KEY is not set. Generate one with: docker compose run --rm php php artisan key:generate --show"

# ---------------------------------------------------------------------------
# Dev only: source is bind-mounted, so dependencies live on the volume.
# ---------------------------------------------------------------------------
if [ "$APP_ENV" = "local" ]; then
    if [ ! -f vendor/autoload.php ]; then
        log "vendor/ missing, running composer install"
        composer install --no-interaction --prefer-dist
    fi
    if [ ! -x ./rr ]; then
        log "roadrunner binary missing, downloading"
        ./vendor/bin/rr get-binary --location "$(pwd)"
        chmod +x ./rr
    fi
    [ -f .rr.yaml ] || : > .rr.yaml
fi

# ---------------------------------------------------------------------------
# Compose always exports OPENROUTER_API_KEY, empty or not, and Laravel's dotenv
# repository is immutable - it will not overwrite a variable that already exists
# in the environment. So an empty value here silently shadows anything set in
# laravel/.env, and the only symptom is a 401 at request time. Say so at boot.
# ---------------------------------------------------------------------------
# The agent runs in the queue worker, not the web container, so a CV mount that
# is present on one and missing on the other only shows up as a failed answer.
# Both services check at boot.
if [ -z "$(find resources/cv -maxdepth 1 -name '*.md' ! -name 'README.md' 2>/dev/null)" ]; then
    log "WARNING: resources/cv has no CV markdown. The avatar cannot answer anything."
    log "WARNING: prod images COPY it from /CV; dev needs the ./CV bind mount on BOTH php and php-worker."
fi

if [ -z "${OPENROUTER_API_KEY:-}" ]; then
    log "WARNING: OPENROUTER_API_KEY is empty. The avatar will answer every question with its failure message."
    log "WARNING: set it in the repository-root .env - a value in laravel/.env is ignored under docker."
fi

# ---------------------------------------------------------------------------
# Writable paths. Named volumes mount empty, so recreate the skeleton.
# ---------------------------------------------------------------------------
mkdir -p \
    storage/app/private \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache

# ---------------------------------------------------------------------------
# Wait for backing services. Redis carries cache, sessions, queue and broadcast
# fan-out, so starting without it just produces a crash loop with noisier logs.
# ---------------------------------------------------------------------------
if [ -n "${REDIS_HOST:-}" ]; then
    # busybox sh has no /dev/tcp, so probe the socket with PHP instead.
    i=0
    until php -r 'exit(@fsockopen(getenv("REDIS_HOST"), (int) (getenv("REDIS_PORT") ?: 6379), $e, $s, 1) ? 0 : 1);'; do
        i=$((i + 1))
        [ "$i" -lt 60 ] || fail "redis at ${REDIS_HOST}:${REDIS_PORT:-6379} never became reachable"
        sleep 1
    done
    log "redis is up (${REDIS_HOST}:${REDIS_PORT:-6379})"
fi

# ---------------------------------------------------------------------------
# SQLite lives on a shared named volume so php and php-worker see one file.
# ---------------------------------------------------------------------------
if [ "$DB_CONNECTION" = "sqlite" ] && [ -n "${DB_DATABASE:-}" ]; then
    mkdir -p "$(dirname "$DB_DATABASE")"
    [ -f "$DB_DATABASE" ] || { log "creating sqlite database at $DB_DATABASE"; : > "$DB_DATABASE"; }
fi

# ---------------------------------------------------------------------------
# Migrations run from exactly one service (APP_RUN_MIGRATIONS=true) to avoid
# two containers racing the same schema on start-up.
# ---------------------------------------------------------------------------
if [ "$APP_RUN_MIGRATIONS" = "true" ]; then
    log "running migrations"
    php artisan migrate --force --no-interaction
fi

# ---------------------------------------------------------------------------
# Config caches are built at runtime, never at image build time: baking them in
# would freeze build-time environment values into the image.
# ---------------------------------------------------------------------------
php artisan config:clear --no-interaction >/dev/null 2>&1 || true
if [ "$APP_ENV" != "local" ]; then
    log "caching config, routes and events"
    php artisan config:cache --no-interaction
    php artisan route:cache --no-interaction
    php artisan event:cache --no-interaction
fi

log "starting: $*"
exec "$@"
