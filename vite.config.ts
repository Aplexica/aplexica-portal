import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const entry = 'index-local.html';

/**
 * The Vite entry is index-local.html (no plain index.html), so GET / 404s in
 * dev. This plugin rewrites root + SPA-deep-link requests to the entry HTML so
 * `pnpm dev:local` opens to a working dashboard and Playwright can navigate
 * via React Router. Production builds rename outputs through
 * rollupOptions.input — this plugin is dev-only.
 */
function spaFallback(): PluginOption {
  return {
    name: 'aplexica:spa-fallback',
    apply: 'serve',
    configureServer(server) {
      // Pre-hook: rewrite root + SPA deep-link URLs to point at the
      // chosen entry HTML file so Vite's built-in static handler picks
      // it up. Skips /api/* (proxied) and anything with a file
      // extension (assets, .js, .css, etc.).
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next();
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        const url = req.url.split('?')[0];
        if (
          url === '/' ||
          (!url.startsWith('/api/') &&
            !url.startsWith('/healthz') &&
            !url.startsWith('/@') &&
            !url.startsWith('/src/') &&
            !url.startsWith('/node_modules/') &&
            !url.includes('.'))
        ) {
          req.url = `/${entry}`;
        }
        next();
      });
    },
  };
}

/**
 * Dev-mode Host-header allowlist that mirrors the daemon's production
 * request validation.
 * Any request whose Host header isn't on the allowlist returns 421
 * Misdirected Request — the same status the daemon returns. The
 * Playwright DNS-rebinding e2e suite exercises this defense
 * end-to-end against the dev server in CI, since the dev server is
 * what the stub daemon sits behind. Runs BEFORE any other middleware
 * so even Vite's static-asset handler can't leak content.
 */
function hostAllowlist(allowedPorts: number[]): PluginOption {
  return {
    name: 'aplexica:host-allowlist',
    apply: 'serve',
    configureServer(server) {
      const allowed = new Set<string>();
      for (const p of allowedPorts) {
        allowed.add(`127.0.0.1:${p}`);
        allowed.add(`localhost:${p}`);
      }
      allowed.add('127.0.0.1');
      allowed.add('localhost');
      server.middlewares.use((req, res, next) => {
        const host = (req.headers.host ?? '').toLowerCase();
        if (allowed.has(host)) return next();
        res.statusCode = 421;
        res.setHeader('Content-Type', 'text/plain');
        res.end('misdirected request');
      });
    },
  };
}

export default defineConfig(() => {
  const devPort = Number(process.env.DEV_PORT ?? 5173);
  return {
    plugins: [
      // Host allowlist must run BEFORE other middleware so even
      // static-asset and HMR requests are gated by the same
      // defense-in-depth as the API surface. Local-mode only.
      hostAllowlist([devPort, 5173]),
      react(),
      spaFallback(),
    ],
    cacheDir: 'node_modules/.vite/local',
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@local': path.resolve(__dirname, 'src/modes/local'),
      },
    },
    // Keep dev dependency pre-bundling on the same JavaScript baseline as
    // production. esbuild 0.28 does not downlevel destructuring for Safari
    // 14 (part of Vite 6's legacy default), while every shipped bundle already
    // targets ES2022 below.
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2022',
      },
    },
    build: {
      outDir: 'dist-local',
      target: 'es2022',
      sourcemap: true,
      rollupOptions: {
        input: path.resolve(__dirname, entry),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      // In local-mode dev, proxy /api/* and /api/events/stream to a
      // running aplexicad (or the e2e fixture daemon on FIXTURE_PORT)
      // so SPA fetches don't fall through to Vite's 404. /healthz is
      // also proxied so the DNS-rebinding e2e suite (which probes
      // /healthz on the dev server) gets a real 200 from the daemon
      // when its Host header is valid.
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${process.env.FIXTURE_PORT ?? 7610}`,
          changeOrigin: false,
          ws: true,
        },
        '/healthz': {
          target: `http://127.0.0.1:${process.env.FIXTURE_PORT ?? 7610}`,
          changeOrigin: false,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
      css: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['e2e/**', 'node_modules/**', 'dist-local/**'],
    },
  };
});
