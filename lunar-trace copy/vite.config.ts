import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, join, extname, normalize } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { connect } from 'node:net';
import { createReadStream, existsSync, statSync } from 'node:fs';

/**
 * The realistic Moon (./moon-explorer, built on 3D Moon by SkyLumi Labs, AGPL-3.0) is served at /moon/ on this same server.
 *   MOON_DEV_MODE=built   (default) its production build is served from moon-explorer/dist, and kept up to date by `vite build --watch`. One port, no second server.
 *   MOON_DEV_MODE=server  the old way: its dev server runs on its own port (MOON_DEV_PORT, 5192) and /moon/ is proxied to it.
 *   MOON_DEV_AUTOSTART=0  start nothing (serve whatever is already there / proxy to whatever is already running).
 */
const MODE = process.env.MOON_DEV_MODE === 'server' ? 'server' : 'built';
const MOON_DIR = resolve(__dirname, 'moon-explorer');
const MOON_DIST = join(MOON_DIR, 'dist');
const MOON_PORT = Number(process.env.MOON_DEV_PORT ?? 5192);
const MOON_DEV_URL = process.env.MOON_DEV_URL ?? `http://localhost:${MOON_PORT}`;
const MOON_MIRROR = process.env.MOON_MIRROR ?? 'https://storage.googleapis.com/skylumi-moon-serve-b7f804/moon/';

/** The data the Moon streams at run time: its tile sets on the public mirror (same as scripts/build-moon.mjs). */
const moonBuildEnv = (): NodeJS.ProcessEnv => ({
  ...process.env,
  NODE_ENV: 'production', // this server runs with NODE_ENV=development; the Moon's build must not inherit it (it would ship the dev-only code)
  VITE_MOON_TILES: `${MOON_MIRROR}tiles/`, VITE_MOON_PATCH: `${MOON_MIRROR}patch/`, VITE_MOON_MID_PATCH: `${MOON_MIRROR}mid-patch/`,
  VITE_MOON_TC: `${MOON_MIRROR}tc/v3/`, VITE_MOON_HORIZONS: `${MOON_MIRROR}horizons/baked-a/`,
});

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.gz': 'application/octet-stream',
};

const portOpen = (port: number): Promise<boolean> => new Promise((done) => {
  const s = connect({ port, host: '127.0.0.1' });
  s.once('connect', () => { s.destroy(); done(true); });
  s.once('error', () => done(false));
});

/** Serves moon-explorer/dist at /moon/ and rebuilds it in the background when the Moon's files change. */
function moonBuilt(): Plugin {
  let child: ChildProcess | null = null;
  const stop = (): void => { child?.kill(); child = null; };
  return {
    name: 'lunar-trace-moon-built',
    apply: 'serve',
    configureServer(server) {
      const log = (m: string): void => server.config.logger.info(`  Moon: ${m}`);
      if (process.env.MOON_DEV_AUTOSTART !== '0') {
        child = spawn('npx', ['vite', 'build', '--watch', '--logLevel', 'warn'], { cwd: MOON_DIR, env: moonBuildEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout?.on('data', (d: Buffer) => { const t = String(d); if (/built in/.test(t)) log('built (served at /moon/)'); else if (t.trim()) process.stdout.write(`  Moon: ${t}`); });
        child.stderr?.on('data', (d: Buffer) => process.stderr.write(`  Moon: ${d}`));
        child.on('exit', () => { child = null; });
        server.httpServer?.once('close', stop);
        process.once('exit', stop);
        log(existsSync(join(MOON_DIST, 'index.html')) ? 'serving the last build; rebuilding in the background' : 'first build running (about a minute); /moon/ will appear when it is done');
      }
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '/').split('?')[0];
        if (url === '/moon') { res.statusCode = 302; res.setHeader('Location', '/moon/'); res.end(); return; }
        if (!url.startsWith('/moon/')) return next();
        const rel = decodeURIComponent(url.slice('/moon/'.length)) || 'index.html';
        const file = normalize(join(MOON_DIST, rel.endsWith('/') ? `${rel}index.html` : rel));
        if (!file.startsWith(MOON_DIST)) { res.statusCode = 403; res.end(); return; }
        if (!existsSync(join(MOON_DIST, 'index.html'))) {
          res.statusCode = 503; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Refresh', '4');
          res.end('<!doctype html><meta charset="utf-8"><body style="background:#08090d;color:#9697a5;font:14px ui-monospace,monospace;display:grid;place-items:center;height:100vh;margin:0">Building the Moon for the first time (about a minute)…</body>');
          return;
        }
        if (!existsSync(file) || !statSync(file).isFile()) { res.statusCode = 404; res.end('not found'); return; }
        const st = statSync(file);
        // Revalidate cheaply: the same file asked again (the lunar module is fetched by the prefetch, the preload and the loader) answers 304, not the whole body.
        const lastModified = st.mtime.toUTCString();
        res.setHeader('Last-Modified', lastModified);
        res.setHeader('Cache-Control', 'no-cache');
        const since = req.headers['if-modified-since'];
        if (since && new Date(since).getTime() >= Math.floor(st.mtimeMs / 1000) * 1000) { res.statusCode = 304; res.end(); return; }
        res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
        res.setHeader('Content-Length', String(st.size));
        createReadStream(file).on('error', () => res.end()).pipe(res);
      });
    },
  };
}

/** The old way (MOON_DEV_MODE=server): the Moon's own dev server beside the site, proxied at /moon/. */
function moonDevServer(): Plugin {
  let child: ChildProcess | null = null;
  const stop = (): void => { child?.kill(); child = null; };
  return {
    name: 'lunar-trace-moon-dev',
    apply: 'serve',
    async configureServer(server) {
      if (process.env.MOON_DEV_AUTOSTART === '0') return;
      if (await portOpen(MOON_PORT)) { server.config.logger.info(`  Moon: already running on :${MOON_PORT}`); return; }
      child = spawn('npx', ['vite', '--port', String(MOON_PORT), '--strictPort'], {
        cwd: MOON_DIR, stdio: 'inherit', env: { ...process.env, MOON_REMOTE_BASE: process.env.MOON_REMOTE_BASE ?? MOON_MIRROR },
      });
      child.on('exit', () => { child = null; });
      server.httpServer?.once('close', stop);
      process.once('exit', stop);
      server.config.logger.info(`  Moon: starting on :${MOON_PORT} (mounted at /moon/)`);
    },
  };
}

export default defineConfig({
  plugins: [react(), MODE === 'built' ? moonBuilt() : moonDevServer()],
  server: {
    host: '0.0.0.0', port: 3000, allowedHosts: true,
    ...(MODE === 'server' ? { proxy: { '^/moon(/|$)': { target: MOON_DEV_URL, changeOrigin: true, ws: true } } } : {}),
  },
  preview: { host: '0.0.0.0', port: 3000 },
  // The Moon app has its own pages and dependencies: keep them out of this app's dependency scan.
  optimizeDeps: { entries: ['index.html', 'explorer.html', 'gallery.html', 'mars/index.html'] },
  build: {
    rollupOptions: {
      // pages: title slide (Moon and Mars), the Mars explorer, spacecraft gallery
      input: { main: resolve(__dirname, 'index.html'), explorer: resolve(__dirname, 'explorer.html'), gallery: resolve(__dirname, 'gallery.html'), mars: resolve(__dirname, 'mars/index.html') },
    },
  },
});
