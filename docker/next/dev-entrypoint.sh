#!/bin/sh
# Dev entrypoint for the Next container.
set -eu

# Next 16 writes .next/dev/lock with the dev server's PID, and .next is
# bind-mounted from the host so the file outlives the container. After any
# unclean stop (docker compose down sends SIGKILL once the grace period
# expires) the next container start finds a lock naming a PID it knows nothing
# about, and next dev aborts with "Another next dev server is already running"
# - the container exits 1 and the site is simply gone, with no error at the
# compose level.
#
# Every container start is a brand new dev server, so any lock present here is
# stale by definition.
if [ -f .next/dev/lock ]; then
    echo "[entrypoint] removing stale next dev lock: $(cat .next/dev/lock)" >&2
    rm -f .next/dev/lock
fi

exec "$@"
