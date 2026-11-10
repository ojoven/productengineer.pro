// Social images (1200x630) drawn by the same map renderer: one for the site, one per
// territory and one per capability. Skill pages use their capability's image.
//
//   node --experimental-strip-types scripts/og.ts
//
// Writes public/og/*.jpg. Needs Playwright's Chromium (npx playwright install chromium).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { loadAtlas, loadGeometry, ROOT } from '../src/atlas/load.ts';
import { renderMap } from '../src/atlas/render.ts';
import { mapCss } from '../src/atlas/map-css.ts';

const STYLE = 'ink' as const; // keep in step with SITE.mapStyle in src/site.ts
const atlas = loadAtlas();
const geometry = loadGeometry();
const out = join(ROOT, 'public', 'og');
mkdirSync(out, { recursive: true });

const font = (f: string) => pathToFileURL(join(ROOT, 'node_modules', '@fontsource', f)).href;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function card(kicker: string, title: string, line: string, map: string) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${font('kalam/400.css')}"><link rel="stylesheet" href="${font('kalam/700.css')}">
<style>${mapCss('light')}
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#fbfaf6;font-family:system-ui,sans-serif}
.map{position:absolute;right:0;top:0;width:720px;height:630px;border-left:1.5px solid #1f3a9c}
.map svg{width:720px;height:630px}
.panel{position:absolute;left:48px;top:0;bottom:0;width:400px;display:flex;flex-direction:column;justify-content:center}
.k{font:600 18px/1.2 system-ui;color:#5a6fbf;letter-spacing:.08em;text-transform:uppercase}
.t{font:700 54px/1.05 'Kalam',cursive;color:#1f3a9c;margin:6px 0 8px}
.l{font:22px/1.35 system-ui;color:#2a3150}
.brand{position:absolute;left:48px;top:36px;font:700 26px 'Kalam',cursive;color:#1f3a9c}
</style></head><body><div class="map">${map}</div><div class="brand">ProductEngineer.pro</div>
<div class="panel"><div class="k">${esc(kicker)}</div><div class="t">${esc(title)}</div><div class="l">${esc(line)}</div></div></body></html>`;
}

const jobs: { file: string; html: string }[] = [];
const map = (focus: string, lit: string[] = []) =>
  renderMap(atlas, geometry, { style: STYLE, focus, width: 720, height: 630, links: false, state: { lit, selected: focus || null } });

jobs.push({
  file: 'default.jpg',
  html: card('The Skill Atlas', 'The map of product engineering', `${atlas.territories.length - 1} territories, ${atlas.capabilities.length} capabilities, ${atlas.skills.length} skills.`, map('')),
});
for (const t of atlas.territories) {
  jobs.push({ file: `${t.id}.jpg`, html: card(t.crossCutting ? 'Cross-cutting' : 'Territory', t.name, t.question, map(t.crossCutting ? '' : t.id, t.crossCutting ? t.capabilities : [])) });
}
for (const c of atlas.capabilities) {
  const t = atlas.nodes.get(c.territory)!;
  jobs.push({ file: `${c.id}.jpg`, html: card(`Capability in ${t.name}`, c.name, `${c.skills.length} skills`, map(c.id)) });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const job of jobs) {
  const tmp = join(out, '.card.html');
  writeFileSync(tmp, job.html);
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(out, job.file), type: 'jpeg', quality: 82 });
}
await browser.close();
import('node:fs').then((fs) => fs.rmSync(join(out, '.card.html'), { force: true }));
console.log(`wrote ${jobs.length} images to public/og/`);
