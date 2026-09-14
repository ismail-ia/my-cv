FROM nginx:1.27-alpine

# openssl for the self-signed fallback certificate, generated at container start
# rather than baked in: a certificate in an image layer is a shared secret that
# ships to every host and cannot be rotated without a rebuild.
RUN apk add --no-cache openssl

COPY nginx.conf /etc/nginx/nginx.conf
COPY snippets/ /etc/nginx/snippets/
COPY templates/ /etc/nginx/templates/
COPY docker-entrypoint.d/ /docker-entrypoint.d/
COPY tls-refresh /usr/local/bin/tls-refresh

RUN chmod +x /docker-entrypoint.d/*.envsh /docker-entrypoint.d/*.sh /usr/local/bin/tls-refresh \
    && mkdir -p /etc/nginx/dynamic /etc/nginx/certs /var/www/certbot

EXPOSE 80 443

# Health over plain :80 so the probe never depends on certificate validity;
# /nginx-health is served before the https redirect for exactly this reason.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/nginx-health >/dev/null 2>&1 || exit 1

# Must stay literally "nginx": the official entrypoint skips every
# /docker-entrypoint.d hook otherwise, and those are what render the config and
# pick the certificate. The renewal reload loop is started by 99-reload-loop.sh.
CMD ["nginx", "-g", "daemon off;"]
