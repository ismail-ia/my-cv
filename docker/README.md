# Container stack

How the stack is built and wired. Running the app, configuring it and testing it
live in the [root README](../README.md); this file covers only the containers.

Two stacks, same topology, separate compose projects so they never share images,
volumes or container names.

| | file | project | HTTP | HTTPS | images |
|---|---|---|---|---|---|
| production | `docker-compose.yml` | `cv-website` | `HTTP_PORT` (8443) | `HTTPS_PORT` (8543) | `cv-website/*:prod` |
| development | `docker-compose.dev.yml` | `cv-website-dev` | `DEV_HTTP_PORT` (8444) | `DEV_HTTPS_PORT` (8544) | `cv-website/*:dev` |

The numbers in brackets are the compose fallbacks, used only when the variable is
unset. `.env.example` overrides all four - production to the real 80/443,
development to 8443/8543 - so check your own `.env` before assuming a port.

The ports differ on purpose. Two stacks bound to the same host port fails
quietly: the second nginx is left in `created`, and every request you make lands
on the first stack instead - which looks exactly like a bug in the app.

Do **not** set `COMPOSE_PROJECT_NAME` in `.env`. It overrides the `name:` key in
both files, which is the only thing keeping the two stacks apart.

## Topology

```
browser ──▶ nginx      ─┬─▶ nextjs   :3000   (all paths)
                        ├─▶ php      :8000   /api/*, /up, /broadcasting/auth
                        └─▶ sockudo  :6001   /ws/*   (prefix stripped)

php, php-worker, sockudo ──▶ redis :6379  (internal network, no host port)
```

`nginx` publishes the only host ports. In production `redis` sits on an
`internal: true` network, unreachable from the host or the internet.

| volume | holds |
|---|---|
| `app-data` | the SQLite file, shared by `php` and `php-worker` |
| `app-storage` | Laravel's `storage/` (prod only) |
| `redis-data` | AOF, so queued jobs survive a restart |
| `letsencrypt` | certificates and the ACME account key |
| `certbot-webroot` | the HTTP-01 challenge directory |
| `php-vendor` | `vendor/` in dev, so the host tree stays free of linux artifacts |

Losing `letsencrypt` means re-issuing, which counts against the
50-certificates-per-week limit for a registered domain.

## Images

| image | from | notes |
|---|---|---|
| `cv-website/php` | `php:8.4-cli-alpine` | Octane + RoadRunner |
| `cv-website/nextjs` | `node:22-alpine` | `output: standalone` in prod |
| `cv-website/nginx` | `nginx:1.27-alpine` | adds the TLS scripts |
| sockudo | `ghcr.io/sockudo/sockudo:5.0.1` | official, pinned, not built here |

Both Dockerfiles take the **repository root** as build context, because they copy
from `/CV` as well as their own subtree. `.dockerignore` keeps that context small.

`php` and `php-worker` are deliberately the same image: one build, one dependency
set, one thing to scan. Only the command differs. The `build:` block lives on the
`php` service alone - declaring it on both made compose build twice and tag both
results identically.

## How configuration reaches the containers

There are two env files, and only one configures anything:

| file | role |
|---|---|
| **repository root `.env`** | the real one. Compose reads it and exports every value into the containers. |
| `laravel/.env` | inert. Kept only so Collision's `artisan test` stops warning; ignored at runtime. |

Laravel's dotenv repository is immutable - it never overwrites a variable already
present in the process environment - so anything compose exports beats
`laravel/.env`, **including an empty value**. A key set only in `laravel/.env` is
silently ignored and surfaces as a 401 at request time rather than a config
error. Production images don't ship `laravel/.env` at all (`.dockerignore`).

Inside the compose files, `x-php-env` and `x-next-public` are YAML anchors shared
by the services that need them, so `php` and `php-worker` cannot drift apart.

## nginx and TLS

`docker/nginx/tls-refresh` derives everything from `APP_URL`:

- a real hostname gets a Let's Encrypt certificate from the `certbot` service
- `localhost`, `*.local`, `*.test` get a self-signed one at container start

A self-signed certificate is always generated first so nginx can bind `:443`
before certbot has ever run, and `tls-refresh` re-points the symlink once a real
certificate lands. `99-reload-loop.sh` re-runs it every 6 hours and reloads.

Two things that were easy to get wrong here:

1. **`05-tls.envsh` is sourced, not executed.** The nginx entrypoint runs `.sh`
   files in a subshell, where `export SERVER_NAME` is lost before envsubst reads
   it. `.envsh` files are sourced into the parent shell.
2. **The HTTP→HTTPS redirect is inside a `location /` block.** A server-level
   `return` runs in the rewrite phase, before location matching, so it also
   catches `/.well-known/acme-challenge/` - which permanently breaks issuance.

`/etc/nginx/conf.d`, `dynamic/` and `certs/` are tmpfs. All three are regenerated
at start from `APP_URL` and the `letsencrypt` volume, so persisting them would
only let a stale copy survive.

## Sockudo

Config is `docker/sockudo/config.{prod,dev}.json`, mounted at
`/app/config/config.json`. Two things to know:

1. **Unknown keys are rejected, and Sockudo falls back to its built-in defaults
   rather than exiting.** After any edit, confirm the log says `explicit
   configuration applied` and not `explicit configuration load failed, retaining
   previous`. One typo'd key silently disables the whole file.
2. **Credentials come from the environment**, not the file:
   `SOCKUDO_DEFAULT_APP_ID` / `_KEY` / `_SECRET`, plus `REDIS_URL`. Redis host and
   port inside the config file are ignored.

Port `6001`, health at `/up`, Prometheus metrics on `:9601/metrics`.

## Checking the proxy path

That nginx is routing to each upstream, rather than that the app works:

```bash
DEV_PORT=$(grep '^DEV_HTTP_PORT=' ../.env | cut -d= -f2)
curl -sI "http://localhost:$DEV_PORT/"
```

WebSocket handshake through nginx, expecting `101 Switching Protocols`:

```bash
curl -si --http1.1 -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' "http://localhost:$DEV_PORT/ws/app/$(grep '^SOCKUDO_APP_KEY=' ../.env | cut -d= -f2)?protocol=7"
```

nginx resolves upstreams through `resolver 127.0.0.11` with variable upstream
names, so one dead service returns 502 instead of preventing nginx from starting.

## Operations

### After changing package.json

Anonymous volumes survive `--force-recreate`, so a new npm dependency needs the
volume renewed or the container keeps the old `node_modules`:

```bash
docker compose -f docker-compose.dev.yml up -d --build -V nextjs
```

### After changing a port or an env var

Compose reuses an existing container when only the published port changed, so the
old (or missing) binding sticks. Force it:

```bash
docker compose -f docker-compose.dev.yml up -d --force-recreate nginx
```

Check what is actually bound with `docker port <container>`, not
`docker compose ps`.

### `load build context` never finishes

The `COPY CV/*` globs make BuildKit load the whole context instead of a filtered
subset, so any large directory not in `.dockerignore` gets walked.
`next/.next` is a culprit; it is an anonymous
volume now and `**/.next` is excluded at any depth. If it returns, look for a
stray build or backup directory inside the repo.

### `nextjs` starts and immediately exits 1

Next 16 writes `.next/dev/lock` with the dev server's PID. After an unclean stop
the next container finds a lock naming a PID it knows nothing about:

```
⨯ Another next dev server is already running.
```

`docker/next/dev-entrypoint.sh` clears it on every start. Compose reports the
stack as up either way, so check `ps -a` for an exited service rather than
trusting `up`'s output.

### `Permission denied` on the bind mount

A container that ever ran as root leaves root-owned files behind, and the next
non-root run fails on `storage/logs/*` or `.rr.yaml`. To find them:

```bash
find laravel next -uid 0 -not -path '*/node_modules/*'
```
