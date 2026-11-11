import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { makeApp, PUBLIC } from './helpers.ts';
import { Atlas } from '../src/atlas.ts';

const toolJson = (r: unknown) => JSON.parse((r as { content: { text: string }[] }).content[0].text);

async function publicClient() {
  const { fetch } = makeApp();
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${PUBLIC}/mcp/public`), { fetch }));
  return client;
}

test('the public endpoint serves the atlas without sign-in and without progress tools', async () => {
  const client = await publicClient();
  const names = (await client.listTools()).tools.map((t) => t.name);
  assert.ok(!names.includes('get_my_progress'));
  assert.ok(names.includes('get_skill'));

  const terr = toolJson(await client.callTool({ name: 'list_territories', arguments: {} }));
  assert.equal(terr.atlas.skills, 4);
  assert.equal(terr.territories[1].skills, 3);
  assert.equal('progress' in terr.territories[1], false);

  const skill = toolJson(await client.callTool({ name: 'get_skill', arguments: { id: 'old-sample-size' } }));
  assert.equal(skill.id, 'sample-size');
  assert.equal('status' in skill, false);
  assert.equal(skill.resources[0].author, 'Evan Miller');
  assert.equal(skill.tools[0].name, 'GrowthBook');
  // related works both ways, as on the site
  assert.deepEqual(skill.related.map((r: { id: string }) => r.id).sort(), ['ab-testing', 'funnel-analysis']);

  const cap = toolJson(await client.callTool({ name: 'get_capability', arguments: { id: '06.1' } }));
  assert.deepEqual(cap.skills.map((s: { id: string }) => s.id), ['sample-size', 'ab-testing']);

  const missing = await client.callTool({ name: 'get_skill', arguments: { id: 'nope' } });
  assert.equal(missing.isError, true);

  const found = toolJson(await client.callTool({ name: 'search_atlas', arguments: { query: 'sample size' } }));
  assert.equal(found.results[0].id, 'sample-size');

  const listed = toolJson(await client.callTool({ name: 'list_skills', arguments: { territory: 'discovery' } }));
  assert.deepEqual(listed.skills.map((s: { id: string }) => s.id), ['user-interviews']);
});

test('2025-era clients that open with initialize still work', async () => {
  const { fetch } = makeApp();
  const res = await fetch('/mcp/public', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'old', version: '1' } },
    }),
  });
  assert.equal(res.status, 200);
  const text = await res.text();
  const json = JSON.parse(text.startsWith('{') ? text : text.split('\n').find((l) => l.startsWith('data:'))!.slice(5));
  assert.equal(json.result.serverInfo.name, 'productengineer-atlas');
  assert.match(json.result.instructions, /Skill Atlas/);
});

test('the exported atlas loads and resolves codes, aliases and search', { skip: !existsSync(new URL('../atlas.json', import.meta.url)) }, () => {
  const atlas = Atlas.load(new URL('../atlas.json', import.meta.url).pathname);
  assert.equal(atlas.territories.length, 12);
  assert.ok(atlas.skills.length > 300);
  const s = atlas.skill('sample-size');
  assert.ok(s);
  assert.equal(atlas.node(s.code)?.id, 'sample-size');
  assert.equal(atlas.territory('X')?.crossCutting, true);
  assert.ok(atlas.search('feature flags').length > 0);
  for (const sk of atlas.skills) for (const r of sk.resources) assert.ok(atlas.resources[r], `${sk.id} -> resource ${r}`);
});
