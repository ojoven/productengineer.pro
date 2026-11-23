// Run after npm run build. Every browser request is fulfilled locally, including the virtual
// production origin and collector. This test cannot pollute real analytics.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const origin = 'https://productengineer.pro';
const browser = await chromium.launch({ headless: true });
const events = [];
const errors = [];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };
let checks = 0;
async function context(mobile = false) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url());
    if (u.hostname === 'analytics.mtorr.es') {
      assert.equal(u.pathname, '/api/track', 'No script, replay, identify or unexpected collector request');
      const payload = req.postDataJSON();
      events.push({ ...payload, props: JSON.parse(payload.properties || '{}') });
      return route.fulfill({ json: { success: true }, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    if (u.hostname === 'productengineer.pro' || u.hostname === '127.0.0.1') {
      if (u.pathname === '/api/catalog') return route.fulfill({ status: 503, json: {} });
      if (u.pathname === '/api/auth/providers') return route.fulfill({ json: { providers: [] } });
      const file = resolve(dist, `.${decodeURIComponent(u.pathname)}${u.pathname.endsWith('/') ? 'index.html' : ''}`);
      assert.ok(file.startsWith(dist), 'Static file must be inside dist');
      try { return await route.fulfill({ body: await readFile(file), contentType: types[extname(file)] || 'application/octet-stream' }); }
      catch { return route.fulfill({ status: 404, body: '' }); }
    }
    // Learning links, catalog favicons and all other external requests stay local too.
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated external destination</title>' });
  });
  ctx.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  return ctx;
}
const named = name => events.filter(e => e.event_name === name);
const wait = (p, name, count) => p.waitForFunction(() => true).then(async () => {
  for (let i = 0; i < 100 && named(name).length < count; i++) await new Promise(r => setTimeout(r, 25));
  assert.ok(named(name).length >= count, `${name}: expected at least ${count}, got ${named(name).length}`);
});
const goto = (p, path, host = origin) => p.goto(host + path, { waitUntil: 'networkidle' });

try {
  const ctx = await context(); const p = await ctx.newPage();
  await goto(p, '/in-practice/zernio/?q=do-not-send@example.com&utm_source=linkedin&code=secret');
  const pageviews = events.filter(e => e.type === 'pageview').length;
  await p.locator('.qt-intro [data-qt-resume]').click();
  await wait(p, 'tour_started', 1); await wait(p, 'tour_step_viewed', 1);
  assert.equal(named('tour_started')[0].props.layout, 'inline');
  assert.equal(named('tour_started')[0].props.start_type, 'new'); checks++;
  await p.locator('[data-qt]').focus(); await p.keyboard.press('ArrowRight'); await wait(p, 'tour_step_viewed', 2);
  assert.equal(named('tour_step_viewed').at(-1).props.navigation, 'keyboard'); checks++;
  await p.locator('[data-qt-expand]').click();
  assert.equal(named('tour_started').length, 1, 'Expansion must not start a second attempt'); checks++;
  await p.locator('[data-qt-progress] button').last().click();
  while (await p.locator('[data-qt]').getAttribute('data-step') !== 'end') await p.locator('[data-qt-next]').click();
  await wait(p, 'tour_end_reached', 1);
  const completion = named('tour_end_reached')[0].props;
  assert.ok(completion.unique_steps_viewed < completion.total_steps, 'Jumping ahead must not claim full coverage');
  await p.locator('[data-qt-prev]').click(); await p.locator('[data-qt-next]').click();
  assert.equal(named('tour_end_reached').length, 1); checks++;
  await p.locator('[data-qt-next]').click(); await wait(p, 'tour_started', 2);
  assert.equal(named('tour_started').at(-1).props.start_type, 'restart');
  assert.notEqual(named('tour_started').at(-1).props.attempt_id, completion.attempt_id); checks++;
  assert.equal(events.filter(e => e.type === 'pageview').length, pageviews, 'Hash/Tour changes must not inflate pageviews');

  await goto(p, '/skills-map/measurement/product-instrumentation/');
  const bulk = p.locator('[data-bulk] button[data-set="learning"]');
  await bulk.click(); await wait(p, 'progress_changed', 1); await bulk.click();
  assert.equal(named('progress_changed').length, 1); assert.equal(named('progress_changed')[0].props.changed_count, 5);
  assert.ok(!('status' in named('progress_changed')[0].props)); checks++;
  const learning = p.locator('a[data-learning-id]').first();
  await learning.click({ modifiers: ['Control'] }); await wait(p, 'learning_link_opened', 1); checks++;

  await goto(p, '/library/');
  await p.locator('#catalog-q').fill('never-find-this-private@example.com');
  await p.locator('#catalog-search').evaluate(el => el.requestSubmit());
  await wait(p, 'search_results_viewed', 1);
  assert.equal(named('search_results_viewed').at(-1).props.result_count, 0);
  await p.locator('#catalog-search').evaluate(el => el.requestSubmit()); await p.waitForTimeout(700);
  assert.equal(named('search_results_viewed').length, 1, 'Repeated submit of the same results must not double count'); checks++;

  await goto(p, '/search/');
  await p.locator('.pagefind-ui__search-input').fill('sample size');
  await wait(p, 'search_results_viewed', 2);
  assert.equal(named('search_results_viewed').at(-1).props.surface, 'site_search');
  assert.ok(named('search_results_viewed').at(-1).props.result_count > 0); checks++;

  await goto(p, '/skills-map/');
  await p.locator('#ex-progress').selectOption('learning'); await wait(p, 'map_used', 1);
  assert.equal(named('map_used').at(-1).props.mode, 'personal'); checks++;
  await goto(p, '/me/');
  await p.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } }));
  await p.locator('[data-copy="mcp-url"]').click(); await wait(p, 'setup_command_copied', 1);
  await p.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
  await p.locator('[data-copy="mcp-cmd"]').click();
  assert.equal(named('setup_command_copied').length, 1); checks++;

  await goto(p, '/about/'); await p.locator('#analytics-optout').click();
  const beforeOptout = events.length;
  await goto(p, '/in-practice/mamitsu/'); await p.locator('.qt-intro [data-qt-resume]').click();
  assert.equal(events.length, beforeOptout, 'Opt-out must suppress every event'); checks++;
  await ctx.close();

  const mob = await context(true); const m = await mob.newPage();
  await goto(m, '/in-practice/zernio/');
  await m.locator('[data-qt-dock] [data-qt-resume]').click(); await wait(m, 'tour_started', 3);
  assert.equal(named('tour_started').at(-1).props.layout, 'fullscreen');
  await m.locator('[data-qt-next]').click();
  const previousExits = named('tour_exited').length;
  await m.locator('[data-qt-close]').click(); await wait(m, 'tour_exited', previousExits + 1);
  assert.equal(named('tour_exited').at(-1).props.reason, 'close');
  assert.equal(named('tour_exited').at(-1).props.step_index, 2); checks++;
  // Scroll away from the overview to expose the persistent mobile dock.
  await m.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await m.locator('[data-qt-dock] [data-qt-resume]').click(); await wait(m, 'tour_started', 4);
  assert.equal(named('tour_started').at(-1).props.entry_point, 'dock');
  assert.equal(named('tour_started').at(-1).props.start_type, 'resume'); checks++;
  await m.reload({ waitUntil: 'networkidle' }); await wait(m, 'tour_started', 5);
  assert.equal(named('tour_started').at(-1).props.start_type, 'restore'); checks++;
  const beforeSwipe = named('tour_step_viewed').length;
  await m.locator('[data-qt]').dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 250, clientY: 300 });
  await m.locator('[data-qt]').dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 300 });
  await wait(m, 'tour_step_viewed', beforeSwipe + 1);
  assert.equal(named('tour_step_viewed').at(-1).props.navigation, 'swipe'); checks++;
  const previousSkillExits = named('tour_exited').length;
  const attempt = named('tour_started').at(-1).props.attempt_id;
  // The synthetic pointer swipe has no native compatibility click; clear the capture guard.
  await m.locator('[data-qt]').dispatchEvent('click');
  await m.locator('.qt-card.is-on .qt-skill a').click();
  await wait(m, 'tour_exited', previousSkillExits + 1);
  assert.equal(named('tour_exited').at(-1).props.reason, 'open_skill');
  const beforeRestore = named('tour_started').length;
  await m.goBack({ waitUntil: 'networkidle' }); await wait(m, 'tour_started', beforeRestore + 1);
  assert.equal(named('tour_started').at(-1).props.attempt_id, attempt); checks++;
  const beforeBack = named('tour_exited').length;
  await m.goBack(); await wait(m, 'tour_exited', beforeBack + 1);
  assert.equal(named('tour_exited').at(-1).props.reason, 'browser_back'); checks++;
  await mob.close();

  const dev = await context(); const d = await dev.newPage(); const beforeLocal = events.length;
  await goto(d, '/in-practice/zernio/', 'http://127.0.0.1'); await d.locator('.qt-intro [data-qt-resume]').click();
  assert.equal(events.length, beforeLocal, 'A built preview on localhost must not collect'); checks++;
  await dev.close();
  assert.ok(!JSON.stringify(events).includes('do-not-send'));
  assert.ok(!JSON.stringify(events).includes('secret'));
  assert.ok(!JSON.stringify(events).includes('private@example.com'));
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(JSON.stringify({ checks, capturedLocally: events.length, eventNames: [...new Set(events.map(e => e.event_name).filter(Boolean))], productionRequests: 0, pageErrors: errors }, null, 2));
} finally { await browser.close(); }
