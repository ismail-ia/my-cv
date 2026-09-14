# CV - single source of truth

Everything here is authored in this directory. Nothing reads a second copy, and
no copy is committed anywhere else.

| Consumer | How it gets the file |
|---|---|
| `Avatar` agent (prod image) | `COPY CV/*.md ./resources/cv/` in `docker/php/Dockerfile` |
| `Avatar` agent (dev) | `./CV:/var/www/html/resources/cv:ro` bind mount |
| PDF download link (prod image) | `COPY CV/*.pdf ./public/assets/docs/` in `docker/next/Dockerfile` |
| PDF download link (dev) | single-file bind mount of the PDF |

`laravel/resources/cv/` and `next/public/assets/docs/` are gitignored - they are
build output.

The markdown is what the AI avatar answers from, and `README.md` is skipped when
the agent loads the directory. Rewriting a bullet here changes what the chatbot
says; there is no second copy of the facts to keep in step.

## Replacing the PDF in dev

The dev stack bind-mounts the PDF as a single file, so replacing it on disk
(rather than editing in place) breaks the mount until the container restarts:

```bash
docker compose -f docker-compose.dev.yml restart nextjs
```
