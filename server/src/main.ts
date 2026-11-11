import { readFileSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { Atlas } from './atlas.ts';
import { loadConfig } from './config.ts';
import { openDb, sweep } from './db.ts';
import { providersFrom } from './providers.ts';
import { createApp } from './app.ts';

const config = loadConfig();
const db = openDb(config.dbPath);
const atlas = Atlas.load(config.atlasPath);
const providers = providersFrom(config);
if (!providers.size) console.warn('No sign-in provider configured: set GITHUB_CLIENT_ID/SECRET and/or GOOGLE_CLIENT_ID/SECRET');
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

const app = createApp({ config, db, atlas, providers, now: Date.now, version });

sweep(db);
const sweeper = setInterval(() => sweep(db), 3600_000);
sweeper.unref();

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.log(
    `productengineer-api ${version} on http://${info.address}:${info.port} for ${config.publicUrl} ` +
      `(sign-in: ${[...providers.keys()].join(', ') || 'none'}; atlas ${atlas.skills.length} skills from ${atlas.generated})`,
  );
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
