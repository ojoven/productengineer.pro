import { defineConfig } from 'astro/config';
import type { AstroIntegration } from 'astro';
import { loadAtlas, loadGeometry, loadSources } from './src/atlas/load.ts';
import { validateAtlas } from './src/atlas/validate.ts';
import { nodePath } from './src/atlas/model.ts';

/** Fails the build when a reference does not resolve or a node has no position. */
function atlasCheck(): AstroIntegration {
  return {
    name: 'atlas-check',
    hooks: {
      'astro:build:start': ({ logger }) => {
        const report = validateAtlas(loadAtlas(), loadSources(), loadGeometry());
        report.warnings.forEach((w) => logger.warn(w));
        if (report.errors.length) {
          report.errors.forEach((e) => logger.error(e));
          throw new Error(`atlas check failed with ${report.errors.length} error(s)`);
        }
        logger.info('atlas check passed');
      },
    },
  };
}

/** A renamed node keeps its old id as an alias; the old URL redirects to the new page. */
function aliasRedirects(): Record<string, string> {
  const atlas = loadAtlas();
  const out: Record<string, string> = {};
  for (const node of [...atlas.territories, ...atlas.capabilities, ...atlas.skills]) {
    for (const alias of node.aliases) {
      const target = nodePath(atlas, node);
      const old = target.replace(new RegExp(`/${node.id}/$`), `/${alias}/`);
      out[old] = target;
    }
  }
  return out;
}

export default defineConfig({
  site: 'https://productengineer.pro',
  trailingSlash: 'always',
  output: 'static',
  build: { format: 'directory' },
  redirects: aliasRedirects(),
  integrations: [atlasCheck()],
  devToolbar: { enabled: false },
});
