// Adds every current node id to src/atlas/ids.lock. Ids in the lock must exist forever,
// either as a current id or as an alias, so saved progress and shared links keep working.
//   node --experimental-strip-types scripts/lock-ids.ts
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadAtlas, ROOT } from '../src/atlas/load.ts';

const file = join(ROOT, 'src', 'atlas', 'ids.lock');
const locked = new Set(existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter((l) => l && !l.startsWith('#')) : []);
const before = locked.size;
for (const id of loadAtlas().nodes.keys()) locked.add(id);
writeFileSync(
  file,
  '# Every node id ever published. Never remove a line: a renamed node keeps its old id in `aliases`.\n' +
    [...locked].sort().join('\n') +
    '\n',
);
console.log(`ids.lock: ${locked.size} ids (${locked.size - before} new)`);
