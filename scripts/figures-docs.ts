// Writes the reference for figures (docs/figures.md and docs/figures/<group>.md) from the catalogue
// in src/components/figures/catalog.ts. Run it after changing the catalogue; `npm test` fails while
// the saved files are out of date.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT } from '../src/atlas/load.ts';
import { figureDocs } from '../src/components/figures/docs.ts';

const files = figureDocs();
for (const [path, text] of Object.entries(files)) {
  const file = join(ROOT, 'docs', path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  console.log(`docs/${path}`);
}
