import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkClientIdUrl, isPublicAddress, parseClientDoc } from '../src/cimd.ts';

test('only public addresses may be fetched', () => {
  for (const a of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '64:ff9b::a00:1']) {
    assert.equal(isPublicAddress(a), false, a);
  }
  for (const a of ['8.8.8.8', '140.82.112.3', '2606:4700:4700::1111', '::ffff:8.8.8.8', '::ffff:808:808']) assert.equal(isPublicAddress(a), true, a);
  assert.equal(isPublicAddress('not-an-ip'), false);
});

test('client_id URLs must be https with a path, on a public host', () => {
  assert.ok(checkClientIdUrl('https://claude.ai/oauth/claude-code-client-metadata'));
  assert.throws(() => checkClientIdUrl('http://agent.example/client.json'));
  assert.throws(() => checkClientIdUrl('https://agent.example/'));
  assert.throws(() => checkClientIdUrl('https://user:pw@agent.example/c.json'));
  assert.throws(() => checkClientIdUrl('https://127.0.0.1/c.json'));
  assert.throws(() => checkClientIdUrl('https://[::1]/c.json'));
  assert.throws(() => checkClientIdUrl('https://localhost/c.json'));
  assert.throws(() => checkClientIdUrl('https://metadata.google.internal/c.json'));
});

test('a document must name itself and list safe redirect URIs', () => {
  const url = 'https://agent.example/c.json';
  const doc = parseClientDoc(url, { client_id: url, client_name: 'Agent', redirect_uris: ['http://127.0.0.1/cb'] });
  assert.equal(doc.client_name, 'Agent');
  assert.throws(() => parseClientDoc(url, { client_id: 'https://other.example/c.json', redirect_uris: ['http://127.0.0.1/cb'] }));
  assert.throws(() => parseClientDoc(url, { client_id: url, redirect_uris: ['http://evil.example/cb'] }));
  assert.throws(() => parseClientDoc(url, { client_id: url, redirect_uris: [] }));
  assert.throws(() => parseClientDoc(url, { client_id: url, redirect_uris: ['https://a.example/cb'], token_endpoint_auth_method: 'private_key_jwt' }));
});
