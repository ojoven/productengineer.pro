// One local command for the static site and authenticated catalog API. Never uses production data.
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const sitePort = process.env.CATALOG_PORT || '4322';
const apiPort = process.env.CATALOG_API_PORT || '8791';
const cli = process.env.TREG_CLI || (spawnSync('treg', ['--version'], { stdio: 'ignore' }).status === 0 ? 'treg' : '');
const env = { ...process.env, API_PORT: apiPort };
const api = spawn(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', '--env-file-if-exists=.env', '--watch', 'src/main.ts'], {
  cwd: root + 'server', stdio: 'inherit', env: { ...env, PUBLIC_URL: `http://localhost:${sitePort}`, PORT: apiPort, HOST: '127.0.0.1', DEV_LOGIN: '1', DB_PATH: root + 'server/data/catalog-preview.sqlite', TREG_CLI: cli },
});
const site = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'dev', '--port', sitePort, '--host', '127.0.0.1', '--ignore-lock'], { cwd: root, stdio: 'inherit', env });
let ending = false;
function stop(code = 0) { if (ending) return; ending = true; api.kill('SIGTERM'); site.kill('SIGTERM'); setTimeout(() => process.exit(code), 1000); }
for (const child of [api, site]) { child.on('error', err => { console.error(err.message); stop(1); }); child.on('exit', code => { if (!ending) stop(code || 0); }); }
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
console.log(`Catalog: http://localhost:${sitePort}/library/\nOperations: http://localhost:${sitePort}/operations/\n${cli ? 'Treg CLI enabled for web, YouTube and X discovery.' : 'Connect Treg to enable web, YouTube and X. GitHub and Hacker News are ready.'}`);
