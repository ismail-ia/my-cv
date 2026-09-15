# CV site

A personal CV site with an AI avatar that answers questions from the CV itself.
Next.js 16 front end, Laravel 13 API on Octane, answers streamed to the browser
over WebSockets. The whole thing runs as a docker compose stack; there is no
step where you install PHP or Node on the host.

**This repository is the work sample.** The site is a CV, but the codebase is
the actual demonstration - it is built the way I would build a production
service, not the way a portfolio demo is usually built. Nothing here is
scaffolded and left alone: every decision below is one I would defend in review,
and the reasoning is written down next to the code that depends on it.

```
browser ──▶ nginx ─┬─▶ nextjs   :3000   the site
                   ├─▶ php      :8000   /api/*, /up, /broadcasting/auth
                   └─▶ sockudo  :6001   /ws/*   WebSocket fan-out

php, php-worker, sockudo ──▶ redis :6379   cache, sessions, queue
```

A chat message is accepted and queued, not answered inline: `ChatController`
returns `202` immediately, `php-worker` runs the agent, and each token is
broadcast to Sockudo and streamed into the page. Asking the same question twice
in a row is deduplicated rather than charged twice.

| | |
|---|---|
| Front end | Next.js 16, React 19, Bootstrap 5 |
| API | Laravel 13, PHP 8.4, Octane + RoadRunner |
| AI | Laravel AI SDK against OpenRouter |
| Realtime | Sockudo 5 (Pusher protocol), Laravel Echo + pusher-js |
| Backing | Redis (cache, sessions, queue), SQLite |
| Edge | nginx, Let's Encrypt or self-signed TLS |

## What this demonstrates

| | |
|---|---|
| **Queue-backed AI streaming** | An LLM answer takes seconds, so the request returns `202` and a worker streams the answer over WebSockets. No Octane worker is held open waiting on a provider. |
| **Idempotency that costs money to get wrong** | A double-click must not buy the same answer twice. A cache claim at the controller plus `ShouldBeUnique` on the job, released on completion rather than left to expire. A duplicate returns `200`, not `409` - the desired state already holds. |
| **A stable wire protocol** | Four broadcast events, not a pass-through of the AI SDK's internal stream. Tool traffic never reaches the browser; an SDK upgrade cannot break the front end. |
| **Back-pressure by design** | Token deltas are coalesced into ~25 publishes instead of ~350, chosen against the 100ms threshold where a UI stops feeling immediate - rather than adding a database purely for Sockudo's rollup bookkeeping. |
| **Grounded AI, not a chat toy** | The agent may answer only from the CV. Unanswerable questions are recorded as a content backlog instead of being improvised. |
| **Containers built for production** | Read-only filesystems, `cap_drop: ALL`, an internal-only network with no route to Redis, one image shared by web and worker, healthchecks that gate startup ordering. |
| **TLS that is not a manual step** | Certificate strategy derives from `APP_URL`: Let's Encrypt for a real domain, self-signed for localhost, issued and renewed by the stack itself. |
| **Accessibility as a test, not a claim** | A Playwright suite asserts axe WCAG 2.1 AA, heading order, contrast, 320px and 200% zoom on every run. |

Most of the interesting decisions are documented where they apply:

| | |
|---|---|
| [laravel/README.md](laravel/README.md) | request lifecycle, the agent, idempotency, the wire protocol |
| [docker/README.md](docker/README.md) | stack topology, images, nginx and TLS, Sockudo, operations |
| [CV/README.md](CV/README.md) | the single source of truth the avatar answers from |
| [qa/README.md](qa/README.md) | brand and accessibility assertions |

## Requirements

Docker Engine with the Compose v2 plugin. Nothing else. An OpenRouter API key
if you want the avatar to actually answer.

## First run

Both stacks read the **repository root `.env`**. This is the only env file that
configures anything - see [Environment files](docker/README.md#environment-files)
for why `laravel/.env` is inert.

```bash
cp .env.example .env
```

Generate an app key and paste it into `APP_KEY`:

```bash
docker compose run --rm --no-deps --entrypoint php php artisan key:generate --show
```

Then fill in the rest:

| Variable | Notes |
|---|---|
| `APP_KEY` | from the command above |
| `SOCKUDO_APP_KEY` | any random string; shared by Laravel, Sockudo and the browser |
| `SOCKUDO_APP_SECRET` | any random string; server-side only |
| `OPENROUTER_API_KEY` | without it the site runs and the avatar fails per request |
| `APP_URL` | your public `https://` origin in production |

Do **not** set `COMPOSE_PROJECT_NAME`. It overrides the `name:` key in both
compose files, which is the only thing keeping the dev and prod stacks (and
their volumes) apart.

You also need the CV files in `/CV` - see [The CV](#the-cv) below.

### After editing .env

```bash
docker compose -f docker-compose.dev.yml up -d
```

`up -d` recreates any container whose configuration changed. **`restart` does
not** - it restarts the same container with the environment it was created with,
so an edited `.env` appears to have no effect. In production the `NEXT_PUBLIC_*`
values are inlined into the client bundle at build time, so changing them needs
a rebuild:

```bash
docker compose up -d --build nextjs
```

## Local development

```bash
docker compose -f docker-compose.dev.yml up --build
```

Then open `http://localhost:<DEV_HTTP_PORT>`, using whatever you set in `.env` -
**http://localhost:8443** with the shipped `.env.example`. HTTPS is on
`DEV_HTTPS_PORT` with a self-signed certificate, so expect a browser warning.

`./laravel`, `./next` and `./CV` are bind-mounted, so edits reload in place:
Octane watches PHP, Next runs the webpack dev server, and `queue:listen` reboots
the framework per job so edited agent code is picked up without a restart.

Backing services are published on loopback for a debugger: php `:8000`,
next `:3000`, sockudo `:6001`, sockudo metrics `:9601`, redis `:6380`.

Check it is actually serving:

```bash
curl -s "http://localhost:$(grep '^DEV_HTTP_PORT=' .env | cut -d= -f2)/up"
```

## Production

Set these in `.env` before bringing the stack up:

```
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com
HTTP_PORT=80
HTTPS_PORT=443
LETSENCRYPT_EMAIL=you@your-domain.com
LETSENCRYPT_STAGING=true
```

`HTTP_PORT=80` is not cosmetic. Let's Encrypt validates HTTP-01 against port 80
of the public name and cannot reach a high port unless something in front
forwards it. Point the domain's DNS at the host first; certificate issuance
needs the name to already resolve.

```bash
docker compose up -d --build
```

TLS follows `APP_URL`'s host automatically. A real domain gets a Let's Encrypt
certificate issued at runtime by the `certbot` service and renewed on a 12-hour
loop; `localhost`, `*.local` and `*.test` get a self-signed one generated at
container start. nginx always binds both ports - a self-signed certificate is
generated first so `:443` can come up before certbot has run.

Leave `LETSENCRYPT_STAGING=true` for the first deploy. The production CA allows
only 5 failed authorisations per hour and a wrong DNS record burns through them
fast. Once a staging certificate is issued, flip it to `false` and recreate:

```bash
docker compose up -d --force-recreate nginx certbot
```

Verify:

```bash
docker compose ps
```

Every service has a healthcheck and `depends_on: condition: service_healthy`,
so `up` only returns once the stack is genuinely serving.

### What production does differently

- Source is baked into the images, not mounted. Rebuild to deploy.
- `redis` sits on an `internal: true` network with no route to the host or the
  internet. `nginx` publishes the only host ports.
- Containers run `read_only` where possible, with `cap_drop: ALL` and
  `no-new-privileges`.
- The worker runs `queue:work` (persistent) rather than `queue:listen`.
- Migrations run from the `php` service only, so it and `php-worker` never race.

## The CV

`/CV` is the single source of truth for both the downloadable PDF and the text
the avatar answers from. Editing a bullet there changes what the chatbot says;
there is no second copy to keep in step.

**The CV files are gitignored**, because they carry a phone number, an email
address and a full employment history. A fresh clone therefore has an empty
`CV/` directory, and both images copy by glob:

```
docker/php/Dockerfile   COPY CV/*.md   ./resources/cv/
docker/next/Dockerfile  COPY CV/*.pdf  ./public/assets/docs/
```

A `COPY` glob that matches nothing is a hard build error, so **supply the CV
files before the first build**. At minimum: one `.md` for the agent and one
`.pdf` matching `PROFILE_CV_PATH`. See [CV/README.md](CV/README.md).

## Tests

```bash
docker compose -f docker-compose.dev.yml exec php php artisan test
```

```bash
docker compose -f docker-compose.dev.yml exec nextjs npm run lint
```

Test isolation depends on `laravel/tests/bootstrap.php`, for a non-obvious
reason - see [Tests](laravel/README.md#tests) before changing `phpunit.xml`.

The browser QA suite in [qa/](qa/README.md) asserts the brand and accessibility
rules against the running page - webfont loading, heading order, contrast, axe
WCAG 2.1 AA, 320px and 200% zoom, chat semantics.

```bash
cd qa && npm install && npx playwright install chromium
BASE_URL="http://localhost:$(grep '^DEV_HTTP_PORT=' ../.env | cut -d= -f2)/" npm run qa
```

## Layout

```
CV/                  CV source. Gitignored, single source of truth.
laravel/             API, AI agent, queue jobs.
  app/AI/            Avatar agent, CV knowledge loader, tools.
  app/Jobs/          ProcessIncomingChat - runs the agent off-request.
  config/profile.php Whose CV this is, read from PROFILE_* env.
next/                The site. App Router, static-ish page + chat client.
docker/              Dockerfiles, nginx config, TLS scripts, sockudo config.
qa/                  Playwright brand and accessibility suite.
docker-compose.yml       production
docker-compose.dev.yml   development
```

Operational detail - troubleshooting a hung `up`, Sockudo's config quirks, port
changes not taking effect, root-owned files on the bind mount - lives in
[docker/README.md](docker/README.md).
