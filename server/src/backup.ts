// Nightly copy of the database (see deploy/api-backup.cron). VACUUM INTO writes a consistent
// snapshot while the server keeps running. Keeps the last 14 days.
//   node --experimental-strip-types src/backup.ts <backup dir>
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from './config.ts';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: backup.ts <backup dir>');
  process.exit(1);
}
mkdirSync(dir, { recursive: true });
const { dbPath } = loadConfig();
const target = join(dir, `productengineer-${new Date().toISOString().slice(0, 10)}.sqlite`);
rmSync(target, { force: true });
const db = new DatabaseSync(dbPath, { readOnly: true });
db.prepare('VACUUM INTO ?').run(target);
db.close();

const keep = 14;
const files = readdirSync(dir)
  .filter((f) => /^productengineer-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f))
  .sort();
for (const f of files.slice(0, Math.max(0, files.length - keep))) rmSync(join(dir, f));
console.log(`${new Date().toISOString()} backup written to ${target}`);
