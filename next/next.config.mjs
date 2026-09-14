/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits .next/standalone with a self-contained server.js and only the
  // node_modules actually reachable from the build - required by the runtime
  // stage in docker/next/Dockerfile.
  output: 'standalone',

  // The container is the deployment unit; source maps and the build id are
  // enough for debugging, the header is just fingerprinting.
  poweredByHeader: false,

  // nginx terminates TLS and compresses; doing it twice wastes CPU per request.
  compress: false,

  // Dev only.
  ...(process.env.NODE_ENV === 'development'
    ? {
        // inotify events do not reliably cross a Docker bind mount on every
        // host filesystem, so the dev server polls instead. A production build
        // never watches, so this has no effect there.
        watchOptions: { pollIntervalMs: 1000 },

        // The browser reaches the dev server through nginx, so the request
        // origin is the proxy (localhost:8443), not localhost:3000. Next 16
        // blocks /_next/* dev resources from an unlisted origin, which breaks
        // the HMR WebSocket. NEXT_ALLOWED_DEV_ORIGINS takes a comma-separated
        // list for anything beyond the local defaults.
        allowedDevOrigins: (
          process.env.NEXT_ALLOWED_DEV_ORIGINS ?? 'localhost,127.0.0.1,[::1]'
        )
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      }
    : {}),
};

export default nextConfig;
