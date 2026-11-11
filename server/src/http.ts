import type { Context } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { Config } from './config.ts';

/** The httpOnly session cookie. */
export const SESSION_COOKIE = 'pe_session';
/**
 * A readable flag next to the session (value "1", no secret in it). Static pages check it to
 * know whether to sync, so visitors without an account never call the API.
 */
export const SIGNED_IN_COOKIE = 'pe_auth';
/** Binds a sign-in to the browser that started it (login CSRF). */
export const LOGIN_COOKIE = 'pe_login';

const secure = (config: Config) => config.publicUrl.startsWith('https://');

export function setSessionCookies(c: Context, config: Config, token: string, expiresAt: number) {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const base = { path: '/', secure: secure(config), sameSite: 'Lax' as const, maxAge };
  setCookie(c, SESSION_COOKIE, token, { ...base, httpOnly: true });
  setCookie(c, SIGNED_IN_COOKIE, '1', { ...base, httpOnly: false });
}

export function clearSessionCookies(c: Context, config: Config) {
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: secure(config) });
  deleteCookie(c, SIGNED_IN_COOKIE, { path: '/', secure: secure(config) });
}

export function setLoginCookie(c: Context, config: Config, state: string) {
  setCookie(c, LOGIN_COOKIE, state, { path: '/api/auth/', secure: secure(config), sameSite: 'Lax', httpOnly: true, maxAge: 600 });
}

export function clearLoginCookie(c: Context, config: Config) {
  deleteCookie(c, LOGIN_COOKIE, { path: '/api/auth/', secure: secure(config) });
}

/** Only same-site paths, so a sign-in link cannot bounce someone to another site. */
export function safeReturn(value: string | undefined, fallback = '/me/'): string {
  if (!value || value.length > 500) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\') || /[\r\n]/.test(value)) return fallback;
  try {
    const u = new URL(value, 'https://x.invalid');
    return u.origin === 'https://x.invalid' ? u.pathname + u.search + u.hash : fallback;
  } catch {
    return fallback;
  }
}

/** Adds a query parameter to a same-site path. */
export function withParam(path: string, key: string, value: string): string {
  const u = new URL(path, 'https://x.invalid');
  u.searchParams.set(key, value);
  return u.pathname + u.search + u.hash;
}

/** The client address. Behind Apache, the last X-Forwarded-For entry is the one Apache added. */
export function clientIp(c: Context, config: Config): string {
  let remote = '';
  try {
    remote = getConnInfo(c).remote.address ?? '';
  } catch {
    remote = '';
  }
  const loopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  if (config.trustProxy && loopback) {
    const xff = c.req.header('x-forwarded-for');
    if (xff) return xff.split(',').at(-1)!.trim();
  }
  return remote || 'unknown';
}

/** Fixed-window rate limit kept in memory. Enough for one small process. */
export class RateLimiter {
  private hits = new Map<string, { count: number; reset: number }>();
  private readonly limit: number;
  private readonly windowMs: number;
  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  allow(key: string, now = Date.now()): boolean {
    const h = this.hits.get(key);
    if (!h || h.reset < now) {
      this.hits.set(key, { count: 1, reset: now + this.windowMs });
      if (this.hits.size > 10_000) this.prune(now);
      return true;
    }
    h.count++;
    return h.count <= this.limit;
  }

  private prune(now: number) {
    for (const [k, h] of this.hits) if (h.reset < now) this.hits.delete(k);
  }
}
