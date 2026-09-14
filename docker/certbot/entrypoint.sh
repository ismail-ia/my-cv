#!/bin/sh
# Obtain and renew the Let's Encrypt certificate for APP_URL's host.
#
# Runtime, not build time: ACME HTTP-01 proves control of a domain by serving a
# token from that domain over port 80, which only the running host can do, and
# certificates expire every 90 days. A certificate baked into an image is a
# secret shipped to every host that pulls it, and renewing it means a rebuild.
set -eu

log() { printf '[certbot] %s\n' "$*" >&2; }

WEBROOT=/var/www/certbot
RENEW_INTERVAL="${CERTBOT_RENEW_INTERVAL:-12h}"

host_from_url() {
    printf '%s' "$1" | sed -e 's|^[a-zA-Z][a-zA-Z0-9+.-]*://||' -e 's|^.*@||' -e 's|/.*$||' -e 's|:[0-9]*$||'
}

DOMAIN="$(host_from_url "${APP_URL:-}")"

case "${DOMAIN:-localhost}" in
    ''|localhost|127.0.0.1|'[::1]'|*.localhost|*.local|*.test)
        # Let's Encrypt will not issue for a name it cannot resolve publicly.
        # nginx is already serving its self-signed certificate, so there is
        # nothing to do - idle rather than crash-loop, so `docker compose ps`
        # shows the truth instead of a restarting container.
        log "APP_URL host is '${DOMAIN:-<empty>}'; nothing to issue. Idling."
        while :; do sleep 24h & wait ${!}; done
        ;;
esac

if [ -z "${LETSENCRYPT_EMAIL:-}" ]; then
    log "FATAL: LETSENCRYPT_EMAIL is required to issue a certificate for $DOMAIN."
    log "It is where expiry warnings go if renewal ever stops working."
    exit 1
fi

# --staging issues from a untrusted test CA with far higher rate limits. Use it
# while validating a deployment: the production endpoint allows 5 failures per
# account per hour, and a misconfigured DNS record burns through that fast.
STAGING_FLAG=""
[ "${LETSENCRYPT_STAGING:-false}" = "true" ] && STAGING_FLAG="--staging"

issue() {
    log "requesting a certificate for $DOMAIN"
    certbot certonly \
        --webroot --webroot-path "$WEBROOT" \
        --domain "$DOMAIN" \
        --email "$LETSENCRYPT_EMAIL" \
        --agree-tos --no-eff-email \
        --non-interactive \
        --keep-until-expiring \
        $STAGING_FLAG
}

if [ -s "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log "existing certificate found for $DOMAIN"
else
    # nginx must already be answering on :80 for the challenge to validate.
    # Failing here is not fatal: nginx keeps serving its self-signed
    # certificate, and the loop below retries rather than leaving the site down.
    issue || log "initial issuance failed; will retry on the renewal cycle"
fi

log "renewal loop running every $RENEW_INTERVAL"
while :; do
    sleep "$RENEW_INTERVAL" & wait ${!}

    if [ -s "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        # A no-op until the certificate is inside its 30-day renewal window.
        certbot renew --webroot --webroot-path "$WEBROOT" --non-interactive \
            || log "renew failed; will retry"
    else
        issue || log "issuance still failing; will retry"
    fi
done
