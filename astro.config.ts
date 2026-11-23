import { defineConfig } from 'astro/config';
import { readdirSync } from 'node:fs';
import mdx from '@astrojs/mdx';
import type { AstroIntegration } from 'astro';
import type { Plugin } from 'vite';
import { request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { loadAtlas, loadGeometry, loadSources } from './src/atlas/load.ts';
import { validateAtlas } from './src/atlas/validate.ts';
import { atlasRedirects } from './src/atlas/redirects.ts';
import { loadEditorial } from './src/editorial/load.ts';
import { validateEditorial } from './src/editorial/validate.ts';

/** Fails the build when a reference does not resolve, a node has no position, or an entry breaks its template. */
function atlasCheck(): AstroIntegration {
  return {
    name: 'atlas-check',
    hooks: {
      'astro:build:start': ({ logger }) => {
        const atlas = loadAtlas();
        const report = validateAtlas(atlas, loadSources(), loadGeometry());
        report.warnings.forEach((w) => logger.warn(w));
        if (report.errors.length) {
          report.errors.forEach((e) => logger.error(e));
          throw new Error(`atlas check failed with ${report.errors.length} error(s)`);
        }
        logger.info('atlas check passed');
        // Every Fieldwork entry points to real skills and entries, and follows its structure.
        const editorial = validateEditorial(atlas, loadEditorial());
        editorial.warnings.forEach((w) => logger.warn(w));
        if (editorial.errors.length) {
          editorial.errors.forEach((e) => logger.error(e));
          throw new Error(`fieldwork check failed with ${editorial.errors.length} error(s)`);
        }
        logger.info('fieldwork check passed');
        // A skill body is named after its skill: src/content/skills/<skill-id>.md
        const skillIds = new Set(atlas.skills.map((s) => s.id));
        const strays = readdirSync('src/content/skills').filter((f) => /^[^_].*\.md$/.test(f) && !skillIds.has(f.slice(0, -3)));
        if (strays.length) {
          strays.forEach((f) => logger.error(`src/content/skills/${f}: no skill has the id "${f.slice(0, -3)}"`));
          throw new Error(`skill body check failed with ${strays.length} error(s)`);
        }
      },
    },
  };
}

/**
 * Development only: sends API, OAuth and MCP paths to the API server (`npm run api`), as Apache
 * does in production. A plain Vite proxy would sit behind Astro's trailing-slash check, which
 * answers /api/me with a 404.
 */
function apiProxy(): Plugin {
  const port = Number(process.env.API_PORT ?? 8790);
  const isApi = (url: string) =>
    /^\/(api|oauth)\//.test(url) || /^\/mcp(\/|\?|$)/.test(url) || url.startsWith('/.well-known/oauth-');
  return {
    name: 'pe-api-proxy',
    enforce: 'post',
    apply: 'serve',
    configureServer(server) {
      const handle = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
        if (!isApi(req.url ?? '')) return next();
        const upstream = httpRequest({ host: '127.0.0.1', port, method: req.method, path: req.url, headers: req.headers }, (r) => {
          res.writeHead(r.statusCode ?? 502, r.headers);
          r.pipe(res);
        });
        upstream.on('error', () => {
          res.statusCode = 502;
          res.end(`API server not reachable on port ${port}. Start it with: npm run api`);
        });
        req.pipe(upstream);
      };
      // Astro puts its own middlewares at the front of the stack in a post hook; this runs after
      // it and goes in front of them.
      return () => {
        server.middlewares.stack.unshift({ route: '', handle: handle as never });
      };
    },
  };
}

export default defineConfig({
  site: 'https://productengineer.pro',
  trailingSlash: 'always',
  output: 'static',
  build: { format: 'directory' },
  redirects: {
    ...atlasRedirects(loadAtlas()),
    '/lab/': '/in-practice/',
    '/lab/etengabe-first-session/': '/in-practice/etengabe-first-session/',
    '/lab/linguaso/': '/in-practice/linguaso/',
    '/lab/productengineer-synced-progress/': '/in-practice/productengineer-synced-progress/',
    '/mikel/': '/about/#who-writes-it',
    '/about/mikel/': '/about/#who-writes-it',
  },
  // MDX lets Fieldwork entries (.mdx) use the figures in src/components/figures/.
  integrations: [mdx(), atlasCheck()],
  devToolbar: { enabled: false },
  // In development the API server (server/, `npm run api`) answers on the same origin, as Apache
  // does in production.
  vite: { plugins: [apiProxy()] },
});
