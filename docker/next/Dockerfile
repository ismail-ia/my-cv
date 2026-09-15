# syntax=docker/dockerfile:1.7
#
# Build context is the repository root (see docker-compose.yml).

# =============================================================================
# base
# =============================================================================
FROM node:22-alpine AS base

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# =============================================================================
# deps - installed from the lockfile only, so it caches across source edits
# =============================================================================
FROM base AS deps

COPY next/package.json next/package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci

# =============================================================================
# builder
# =============================================================================
FROM base AS builder

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# have to be present here, not just at runtime.
ARG NEXT_PUBLIC_SOCKUDO_KEY
ARG NEXT_PUBLIC_SOCKUDO_PATH=/ws
ARG NEXT_PUBLIC_API_BASE=/api
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_PROFILE_NAME
ARG NEXT_PUBLIC_PROFILE_TITLE
ARG NEXT_PUBLIC_PROFILE_EMAIL
ARG NEXT_PUBLIC_PROFILE_PHONE
ARG NEXT_PUBLIC_PROFILE_PHONE_DISPLAY
ARG NEXT_PUBLIC_PROFILE_LINKEDIN
ARG NEXT_PUBLIC_PROFILE_LOCATION
ARG NEXT_PUBLIC_PROFILE_CV_PATH
ARG NEXT_PUBLIC_PROFILE_AVAILABILITY
# Unset values are left empty on purpose rather than defaulted here: lib/profile.js
# owns the fallbacks, so there is one place to look when a value is wrong.
ENV NEXT_PUBLIC_SOCKUDO_KEY=$NEXT_PUBLIC_SOCKUDO_KEY \
    NEXT_PUBLIC_SOCKUDO_PATH=$NEXT_PUBLIC_SOCKUDO_PATH \
    NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_PROFILE_NAME=$NEXT_PUBLIC_PROFILE_NAME \
    NEXT_PUBLIC_PROFILE_TITLE=$NEXT_PUBLIC_PROFILE_TITLE \
    NEXT_PUBLIC_PROFILE_EMAIL=$NEXT_PUBLIC_PROFILE_EMAIL \
    NEXT_PUBLIC_PROFILE_PHONE=$NEXT_PUBLIC_PROFILE_PHONE \
    NEXT_PUBLIC_PROFILE_PHONE_DISPLAY=$NEXT_PUBLIC_PROFILE_PHONE_DISPLAY \
    NEXT_PUBLIC_PROFILE_LINKEDIN=$NEXT_PUBLIC_PROFILE_LINKEDIN \
    NEXT_PUBLIC_PROFILE_LOCATION=$NEXT_PUBLIC_PROFILE_LOCATION \
    NEXT_PUBLIC_PROFILE_CV_PATH=$NEXT_PUBLIC_PROFILE_CV_PATH \
    NEXT_PUBLIC_PROFILE_AVAILABILITY=$NEXT_PUBLIC_PROFILE_AVAILABILITY \
    NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY next/ ./
# Served at /assets/docs/... by the header, Work and Contact download links.
COPY CV/*.pdf ./public/assets/docs/
RUN npm run build

# =============================================================================
# prod - standalone output only: no npm, no full node_modules tree
# =============================================================================
FROM base AS prod

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# `node` (uid 1000) ships with the image; nothing here needs root.
USER node

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

# =============================================================================
# dev - source is bind-mounted; node_modules stay in the image layer
# =============================================================================
FROM base AS dev

ENV NODE_ENV=development \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    WATCHPACK_POLLING=true

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node next/package.json ./package.json

RUN mkdir -p /app/.next && chown node:node /app/.next

COPY docker/next/dev-entrypoint.sh /usr/local/bin/dev-entrypoint
RUN chmod +x /usr/local/bin/dev-entrypoint

USER node

ENTRYPOINT ["/usr/local/bin/dev-entrypoint"]

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=5 \
    CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# --webpack instead of Turbopack. Verified on this host: with the source on a
# Docker bind mount, Turbopack's watcher never fires and edits are silently
# ignored, while webpack reloads in ~5s. It is specific to Turbopack's watcher,
# not to inotify across the mount - Octane's chokidar watcher sees the same
# edits fine. `next build` in the prod stage still uses the default pipeline.
CMD ["npx", "next", "dev", "--webpack"]
