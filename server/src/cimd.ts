// Client ID Metadata Documents: an agent's client_id is an https URL serving a JSON document
// that names it and lists its redirect URIs. Fetching a URL that anyone can supply is a
// server-side request forgery risk, so the fetch:
// - only goes to https on a public address, checked inside the socket's own DNS lookup, so a
//   name cannot resolve to something public for the check and private for the connection;
// - does not follow redirects, times out after 5 s and reads at most 32 KB.
import { request } from 'node:https';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { validRedirectUri } from './oauth.ts';

export interface ClientDoc {
  client_id: string;
  client_name: string | null;
  client_uri?: string;
  redirect_uris: string[];
}
export type ClientMetadataFetcher = (url: string) => Promise<{ doc: ClientDoc; maxAgeMs: number }>;

const MAX_BYTES = 32 * 1024;
const TIMEOUT_MS = 5000;
const MIN_AGE = 5 * 60_000;
const MAX_AGE = 24 * 3600_000;

const blocked = new BlockList();
for (const [net, bits] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(net, bits, 'ipv4');
}
for (const [net, bits] of [
  ['::', 128],
  ['::1', 128],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(net, bits, 'ipv6');
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  if (family === 6) {
    // IPv4-mapped (::ffff:a.b.c.d or ::ffff:abcd:ef01) is judged as the IPv4 address it wraps.
    // Node's BlockList would match plain IPv4 against an ::ffff:0:0/96 rule, so that range is
    // handled here instead of in the list. NAT64 (64:ff9b::/96) can reach anything: refused.
    const lower = address.toLowerCase();
    if (lower.startsWith('64:ff9b:')) return false;
    const dotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return isPublicAddress(dotted[1]);
    const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const [hi, lo] = [parseInt(hex[1], 16), parseInt(hex[2], 16)];
      return isPublicAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return !blocked.check(address, 'ipv6');
  }
  return false;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

export function safeLookup(hostname: string, options: object, callback: LookupCallback) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    const list = addresses as LookupAddress[];
    const bad = list.find((a) => !isPublicAddress(a.address));
    if (!list.length || bad) return callback(Object.assign(new Error(`${hostname} resolves to a non-public address`), { code: 'EBLOCKED' }), []);
    if ((options as { all?: boolean }).all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

export function checkClientIdUrl(value: string): URL {
  const u = new URL(value);
  if (u.protocol !== 'https:') throw new Error('client_id URL must be https');
  if (u.username || u.password) throw new Error('client_id URL must not carry credentials');
  if (u.hash) throw new Error('client_id URL must not have a fragment');
  if (u.pathname === '/' || !u.pathname) throw new Error('client_id URL must have a path');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicAddress(host)) throw new Error('client_id URL points to a non-public address');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new Error('client_id URL points to a local name');
  }
  return u;
}

function get(url: URL): Promise<{ status: number; body: string; cacheControl?: string; contentType?: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      { method: 'GET', headers: { Accept: 'application/json', 'User-Agent': 'productengineer.pro' }, lookup: safeLookup as never, timeout: TIMEOUT_MS },
      (res) => {
        let size = 0;
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy(new Error('client metadata document is too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
            cacheControl: res.headers['cache-control'],
            contentType: res.headers['content-type'],
          }),
        );
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('client metadata fetch timed out')));
    req.on('error', reject);
    req.end();
  });
}

/** Checks a fetched document against the URL it came from. */
export function parseClientDoc(url: string, raw: unknown): ClientDoc {
  if (!raw || typeof raw !== 'object') throw new Error('client metadata is not a JSON object');
  const doc = raw as Record<string, unknown>;
  if (doc.client_id !== url) throw new Error('client_id in the document does not match its URL');
  const uris = doc.redirect_uris;
  if (!Array.isArray(uris) || !uris.length || uris.length > 20 || !uris.every(validRedirectUri)) throw new Error('invalid redirect_uris');
  const method = doc.token_endpoint_auth_method;
  if (method !== undefined && method !== 'none') throw new Error(`token_endpoint_auth_method ${String(method)} is not supported`);
  return {
    client_id: url,
    client_name: typeof doc.client_name === 'string' ? doc.client_name.trim().slice(0, 100) || null : null,
    client_uri: typeof doc.client_uri === 'string' && doc.client_uri.startsWith('https://') ? doc.client_uri.slice(0, 500) : undefined,
    redirect_uris: uris as string[],
  };
}

export const fetchClientMetadata: ClientMetadataFetcher = async (value) => {
  const url = checkClientIdUrl(value);
  const res = await get(url);
  if (res.status !== 200) throw new Error(`client metadata HTTP ${res.status}`);
  let raw: unknown;
  try {
    raw = JSON.parse(res.body);
  } catch {
    throw new Error('client metadata is not JSON');
  }
  const doc = parseClientDoc(value, raw);
  const maxAge = Number(res.cacheControl?.match(/max-age=(\d+)/)?.[1] ?? 3600) * 1000;
  return { doc, maxAgeMs: Math.min(MAX_AGE, Math.max(MIN_AGE, maxAge)) };
};
