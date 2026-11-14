// Social images (1200x630) drawn by the same map renderer: one for the site, one per
// territory and one per capability. Skill pages use their capability's image. Fieldwork entries
// with a product logo or a maker's portrait get their own: the product, the maker and the map
// with the skills the entry covers lit.
//
//   node --experimental-strip-types scripts/og.ts             all of them
//   node --experimental-strip-types scripts/og.ts fieldwork   only the fieldwork entries
//
// Writes public/og/*.jpg and public/og/fieldwork/<id>.jpg. Needs Playwright's Chromium
// (npx playwright install chromium).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { loadAtlas, loadGeometry, ROOT } from '../src/atlas/load.ts';
import { renderMap } from '../src/atlas/render.ts';
import { mapCss } from '../src/atlas/map-css.ts';
import { loadEditorial } from '../src/editorial/load.ts';

const atlas = loadAtlas();
const geometry = loadGeometry();
const out = join(ROOT, 'public', 'og');
mkdirSync(out, { recursive: true });

const font = (f: string) => pathToFileURL(join(ROOT, 'node_modules', '@fontsource', f)).href;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function card(kicker: string, title: string, line: string, map: string) {
  return `<!doctype html><html><head><meta charset="utf-8">
${['ibm-plex-sans/400.css', 'ibm-plex-sans/500.css', 'ibm-plex-sans/600.css', 'ibm-plex-sans-condensed/600.css', 'ibm-plex-mono/400.css', 'ibm-plex-mono/500.css'].map((c) => `<link rel="stylesheet" href="${font(c)}">`).join('')}
<style>${mapCss('light')}
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#f2f0ea;color:#141412;font-family:'IBM Plex Sans',sans-serif}
.map{position:absolute;right:0;top:0;width:700px;height:630px;border-left:2px solid #141412}
.map svg{width:700px;height:630px}
.panel{position:absolute;left:48px;top:0;bottom:0;width:410px;display:flex;flex-direction:column;justify-content:center}
.k{font:500 17px/1.2 'IBM Plex Mono',monospace;color:#c23400;letter-spacing:.02em}
.t{font:600 64px/1 'IBM Plex Sans Condensed',sans-serif;letter-spacing:-.02em;margin:14px 0 14px}
.l{font:22px/1.35 'IBM Plex Sans',sans-serif;color:#3d3b36}
.brand{position:absolute;left:48px;top:40px;font:600 20px 'IBM Plex Sans Condensed',sans-serif;letter-spacing:.05em;text-transform:uppercase;display:flex;gap:10px;align-items:center}
.brand span{color:#76736a}
.foot{position:absolute;left:48px;bottom:40px;font:500 14px 'IBM Plex Mono',monospace;color:#76736a;letter-spacing:.06em;text-transform:uppercase}
</style></head><body><div class="map">${map}</div><div class="brand"><svg width="24" height="26" viewBox="0 0 22 24"><path d="M11 1 21 6.75v11.5L11 23 1 18.25V6.75Z" fill="none" stroke="#141412" stroke-width="1.8"/><path d="M11 7.5 15.5 10v5L11 17.5 6.5 15v-5Z" fill="#ff4d12"/></svg><span>ProductEngineer<span>.pro</span></span></div>
<div class="panel"><div class="k">${esc(kicker)}</div><div class="t">${esc(title)}</div><div class="l">${esc(line)}</div></div></body></html>`;
}

const only = process.argv[2];
const jobs: { file: string; html: string }[] = [];
const map = (focus: string, lit: string[] = []) =>
  renderMap(atlas, geometry, { focus, width: 700, height: 630, links: false, state: { lit, selected: focus || null } });

if (only !== 'fieldwork') {
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
}

// ---- fieldwork entries: product logo, the maker's portrait, the title and the lit map
const KIND: Record<string, string> = { review: 'Review', comparison: 'Comparison', interview: 'Interview', profile: 'Profile', observation: 'Observation', experiment: 'Experiment', improvement: 'Improvement', 'case-study': 'Case study' };
const img = (p: string) => pathToFileURL(join(ROOT, 'public', p)).href;

function entryCard(e: ReturnType<typeof loadEditorial>['fieldwork'][number]) {
  const d = e.data;
  const subject = 'subjects' in d ? d.subjects[0] : undefined;
  const person = 'person' in d ? d.person : undefined;
  const [lead, rest] = d.title.includes(': ') ? [d.title.slice(0, d.title.indexOf(': ')), d.title.slice(d.title.indexOf(': ') + 2)] : ['', d.title];
  const territories = new Set(d.skills.map((s) => { const n = atlas.nodes.get(s); return n?.level === 'skill' ? n.territory : undefined; }).filter(Boolean)).size;
  const lit = renderMap(atlas, geometry, { focus: '', width: 640, height: 630, links: false, state: { lit: d.skills, selected: null } });
  return `<!doctype html><html><head><meta charset="utf-8">
${['ibm-plex-sans/400.css', 'ibm-plex-sans/500.css', 'ibm-plex-sans/600.css', 'ibm-plex-sans-condensed/600.css', 'ibm-plex-mono/400.css', 'ibm-plex-mono/500.css'].map((c) => `<link rel="stylesheet" href="${font(c)}">`).join('')}
<style>${mapCss('light')}
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#f2f0ea;color:#141412;font-family:'IBM Plex Sans',sans-serif}
.map{position:absolute;right:0;top:0;width:640px;height:630px;border-left:2px solid #141412}
.map svg{width:640px;height:630px}
.brand{position:absolute;left:48px;top:40px;font:600 20px 'IBM Plex Sans Condensed',sans-serif;letter-spacing:.05em;text-transform:uppercase;display:flex;gap:10px;align-items:center}
.brand span{color:#76736a}
.panel{position:absolute;left:48px;top:112px;width:470px}
.k{font:500 16px/1.2 'IBM Plex Mono',monospace;color:#b8195f;letter-spacing:.08em;text-transform:uppercase}
.faces{display:flex;align-items:center;margin:22px 0 20px}
.faces img{width:96px;height:96px;display:block}
.logo{border-radius:22px}
.avatar{border-radius:50%;image-rendering:pixelated;margin-left:-14px;box-shadow:0 0 0 5px #f2f0ea}
.lead{font:600 76px/0.95 'IBM Plex Sans Condensed',sans-serif;letter-spacing:-.02em}
.rest{font:600 31px/1.12 'IBM Plex Sans Condensed',sans-serif;letter-spacing:-.01em;margin-top:10px;color:#141412}
.foot{position:absolute;left:48px;bottom:40px;width:470px;display:flex;justify-content:space-between;font:500 14px 'IBM Plex Mono',monospace;color:#76736a;letter-spacing:.06em;text-transform:uppercase}
.foot b{color:#141412;font-weight:500}
</style></head><body><div class="map">${lit}</div><div class="brand"><svg width="22" height="25" viewBox="0 0 17.32 20"><path d="M8.66 0 17.32 5v10L8.66 20 0 15V5Z" fill="#141412"/></svg><span style="color:#141412;text-transform:none;letter-spacing:0;font-size:24px">productengineer<span>.pro</span></span></div>
<div class="panel"><div class="k">Fieldwork · ${esc(KIND[d.kind] ?? d.kind)}</div>
<div class="faces">${subject?.logo ? `<img class="logo" src="${img(subject.logo)}">` : ''}${person?.avatar ? `<img class="avatar" src="${img(person.avatar)}">` : ''}</div>
${lead ? `<div class="lead">${esc(lead)}</div>` : ''}<div class="rest">${esc(rest)}</div></div>
<div class="foot"><span>${person ? `<b>${esc(person.name)}</b>` : ''}</span><span>${territories} territories · ${d.skills.length} skills</span></div></body></html>`;
}

if (!only || only === 'fieldwork') {
  mkdirSync(join(out, 'fieldwork'), { recursive: true });
  for (const e of loadEditorial().fieldwork) {
    const d = e.data;
    if (d.placeholder || d.draft || !('subjects' in d)) continue;
    if (!d.subjects[0]?.logo && !d.person?.avatar) continue;
    jobs.push({ file: `fieldwork/${e.id}.jpg`, html: entryCard(e) });
  }
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
