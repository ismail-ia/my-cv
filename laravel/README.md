# API and AI avatar

The Laravel service behind the CV site. It exposes a small chat API, runs the
Avatar agent against the CV, and streams answers to the browser over Sockudo.

Running it is [the root README](../README.md); the containers it runs in are
[docker/README.md](../docker/README.md). This file is the application itself.

Laravel 13 on PHP 8.4, served by Octane + RoadRunner.

## Request lifecycle

A message is **accepted and queued, never answered inline**. An LLM answer takes
seconds; holding an Octane worker open for it would block a request slot and tie
the answer to a connection that may not survive.

```
POST /api/chat/session   ─▶ mint chat_id + channel, cache it       200
                            (browser subscribes BEFORE asking)

POST /api/chat           ─▶ validate, verify session, claim        202 queued
                            dispatch ProcessIncomingChat

php-worker               ─▶ ChatService::processMessage
                              Avatar::make()->stream($message)
                              buffer deltas ──▶ broadcast to Sockudo
                              release the claim
```

The channel is issued by the server, not chosen by the client. That stops a
caller naming someone else's channel, and it forces the ordering: the browser
subscribes before any message is queued. Without it the worker can publish the
first deltas into a channel nobody is listening on yet, and the answer starts
mid-sentence.

| endpoint | returns | throttle |
|---|---|---|
| `POST /api/chat/session` | `chat_id`, `channel`, event names | 10/min per IP |
| `POST /api/chat` | `202 queued`, `200 duplicate`, `410 expired` | 8/min, 120/day per IP |
| `GET /up` | health | - |

Both endpoints are unauthenticated and each message costs money, so opening a
session gets a looser limit than sending one.

## The wire protocol

Four events, deliberately small and stable, rather than a pass-through of the AI
SDK's internal stream events. The browser should not have to know the agent made
a tool call, and a change in the SDK's event vocabulary should not break the
front end.

| event | payload |
|---|---|
| `chat.delta` | `{ delta }` - a chunk of answer text |
| `chat.done` | `{}` |
| `chat.failed` | `{ message }` - carries the contact email as a fallback |
| `chat.suggestions` | `{ suggestions }` - follow-up questions for the next turn |

Tool traffic never reaches the browser. It can carry the visitor's own contact
details, and it is large enough to hit the socket's per-message limit.

### Why deltas are buffered

`Support/StreamDeltaBuffer` coalesces tokens into fewer, larger broadcasts:
one publish per flush instead of one per token. A 250-word answer is roughly 350
deltas; at a 60ms window that becomes about 25 publishes, and text still appears
continuously - 60ms sits below the ~100ms threshold where a UI stops feeling
immediate.

Sockudo has its own append rollup, but it lives behind `ai_transport`, which
requires a durable shared version store (postgres/mysql/dynamodb - memory and
redis are both rejected). Doing the same job here avoids adding a database whose
only purpose would be rollup bookkeeping.

## The AI layer

```
app/AI/
  Agents/Avatar.php              answers as the CV's owner, first person
  Agents/FollowUpQuestions.php   proposes the next questions to ask
  Knowledge/CvKnowledge.php      loads and caches the CV markdown
  Tools/SaveCommunicationRequest.php   captures a visitor who wants contact
  Tools/SaveUnansweredQuestion.php     records what the CV could not answer
```

**Grounding is strict by design.** The site's own copy promises visitors that the
avatar answers only from the CV and that every number it gives already appears on
the page. An invented client name or an inflated metric is not a cosmetic bug -
it is the site lying about its owner. The system prompt forbids inferring,
extrapolating, rounding or combining figures, and the two tools exist so the
agent has somewhere to put a request it should not answer from the CV.

`CvKnowledge` reads `resources/cv/` and caches on a key derived from each file's
path, mtime and size, so editing the CV invalidates the cache without a manual
flush. It calls `clearstatcache()` first, because under Octane the process is
long-lived and would otherwise serve a stale `stat()`. `README.md` is skipped.

The CV is not authored here - `resources/cv/` is build output. See
[CV/README.md](../CV/README.md).

The provider is OpenRouter, configured in `config/ai.php`. The `openrouter.models.text`
block is load-bearing: without it the provider falls back to its own hardcoded
defaults and `OPENROUTER_MODEL` is silently ignored.

## Idempotency

A visitor who double-clicks, or retries on a flaky connection, must not pay for
the same answer twice. Two layers, because they fail differently:

1. **`Chat/DuplicateMessageGuard`** - `Cache::add()` (Redis `SET NX EX`) on a
   fingerprint of the chat id plus the normalised message: whitespace collapsed,
   lowercased, hashed with `xxh128`. Claimed at the controller, so a duplicate is
   rejected before a job is ever dispatched.
2. **`ShouldBeUnique` on `ProcessIncomingChat`** - the same fingerprint as
   `uniqueId()`, which closes the window where two requests land in the same
   millisecond and both pass the check.

The job releases the claim in a `finally` block and again in `failed()`, so a
retry is possible as soon as the answer is delivered rather than after the lease
expires.

A duplicate returns **200, not 409**. Nothing went wrong: the request was
understood and the desired state - "this question is being answered" - already
holds. The honest reply is success plus a note that there was nothing new to do.
The browser uses it to drop the message it optimistically drew.

## Configuration

`config/profile.php` holds whose CV this is - name, title, email, phone,
LinkedIn, location, availability - read from `PROFILE_*` environment variables
and used by both the page and the agent. Nothing personal is hardcoded; changing
the availability line changes what the avatar says about it.

`laravel/.env` is **inert** under docker. Compose exports the real configuration
into the process environment, and Laravel's dotenv repository never overwrites a
variable that is already set. See
[how configuration reaches the containers](../docker/README.md#how-configuration-reaches-the-containers).

## Data

SQLite, on a volume shared with the worker.

| table | holds |
|---|---|
| `communication_requests` | visitors who asked to be contacted, via the agent's tool |
| `unanswered_questions` | questions the CV could not answer - a content backlog |
| `agent_conversations` | conversation history for the AI SDK |

## Tests

```bash
php artisan test
```

`tests/bootstrap.php` applies `phpunit.xml`'s `<php><env>` block into `$_SERVER`
before the framework boots. That is load-bearing, not tidiness. Compose exports
the live stack's configuration into every container, Laravel's `Env` repository
reads `$_SERVER` first, and PHPUnit's `<env>` entries lose even with
`force="true"`. Without the bootstrap the suite runs against the real Redis, the
real queue and the real SQLite file - and `RefreshDatabase` drops those tables.

After touching `phpunit.xml` or the bootstrap, verify isolation: during a test
run `DB_DATABASE` must be `:memory:` and `CACHE_STORE` must be `array`.
