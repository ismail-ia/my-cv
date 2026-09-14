#!/bin/sh
# Adopt renewed certificates without a restart.
#
# Backgrounded from here rather than from the image CMD: the official entrypoint
# only runs /docker-entrypoint.d/* when its first argument is literally "nginx",
# so replacing CMD with a shell loop silently skips every hook - including the
# one that renders the config. This subshell is reparented to PID 1 when the
# entrypoint execs nginx, and outlives this script.
(
    while :; do
        sleep 6h
        /usr/local/bin/tls-refresh && nginx -s reload
    done
) &
