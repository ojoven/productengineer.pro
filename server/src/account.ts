// The site's own API, used by the static pages on the same origin: sign-in, the profile, synced
// progress and the list of connected agents. Cookies only; no CORS.
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import * as z from 'zod/v4';
import type { Deps } from './app.ts';
import { pkceChallenge, randomToken, safeEqual } from './crypto.ts';
import {
  clearLoginCookie,
  clearSessionCookies,
  clientIp,
  LOGIN_COOKIE,
  RateLimiter,
  safeReturn,
  SESSION_COOKIE,
  setLoginCookie,
  setSessionCookies,
  withParam,
} from './http.ts';
import type { ProviderId } from './providers.ts';
import {
  createSession,
  deleteUser,
  endSession,
  getUser,
  identitiesOf,
  linkIdentity,
  readProgress,
  readSession,
  renameUser,
  signIn,
  STATUSES,
  writeChanges,
  type User,
} from './users.ts';
import { listGrants, revokeGrant } from './oauth.ts';

type Env = { Variables: { user: User | undefined; sessionToken: string | undefined } };

const ProgressBody = z.object({
  changes: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        status: z.enum(STATUSES as [string, ...string[]]),
        at: z.number().finite(),
      }),
    )
    .max(2000),
});
const ProfileBody = z.object({ name: z.string().max(200).nullable() });

export function accountRoutes(deps: Deps) {
  const { config, db, atlas, providers, now } = deps;
  const app = new Hono<Env>();
  const signInLimit = new RateLimiter(30, 10 * 60_000);
  const writeLimit = new RateLimiter(600, 60_000);

  /** Reads the session cookie on every request and slides its expiry. */
  const session: MiddlewareHandler<Env> = async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    const s = readSession(db, token, now());
    c.set('user', s?.user);
    c.set('sessionToken', s ? token : undefined);
    if (s?.renewed) setSessionCookies(c, config, token!, s.expiresAt);
    await next();
  };

  /** State-changing calls must come from this site: JSON bodies and a same-origin Origin. */
  const sameOrigin: MiddlewareHandler<Env> = async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      const origin = c.req.header('origin');
      if (origin && origin !== config.publicUrl) return c.json({ error: 'cross_origin' }, 403);
      if (c.req.header('sec-fetch-site') === 'cross-site') return c.json({ error: 'cross_origin' }, 403);
      if (c.req.method !== 'DELETE' && !c.req.header('content-type')?.startsWith('application/json')) {
        return c.json({ error: 'json_required' }, 415);
      }
      if (!writeLimit.allow(clientIp(c, config), now())) return c.json({ error: 'rate_limited' }, 429);
    }
    await next();
  };

  const requireUser: MiddlewareHandler<Env> = async (c, next) => {
    if (!c.get('user')) {
      clearSessionCookies(c, config);
      return c.json({ error: 'signed_out' }, 401);
    }
    await next();
  };

  app.use('*', session);
  app.use('*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
  });

  // ---- sign-in -----------------------------------------------------------------------------

  app.get('/auth/providers', (c) => c.json({ providers: [...providers.values()].map((p) => ({ id: p.id, label: p.label })) }));

  app.get('/auth/:provider/start', (c) => {
    const provider = providers.get(c.req.param('provider') as ProviderId);
    const returnTo = safeReturn(c.req.query('return'));
    if (!provider) return c.redirect(withParam(returnTo, 'auth_error', 'provider'), 302);
    if (!signInLimit.allow(clientIp(c, config), now())) return c.redirect(withParam(returnTo, 'auth_error', 'rate_limited'), 302);
    const state = randomToken();
    const verifier = randomToken();
    const nonce = randomToken(16);
    const user = c.get('user');
    const linkUserId = c.req.query('link') === '1' && user ? user.id : null;
    const as = provider.id === 'dev' ? (c.req.query('as') ?? 'dev') : null;
    db.prepare(
      'INSERT INTO login_states (state, provider, verifier, nonce, return_to, link_user_id, extra, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(state, provider.id, verifier, nonce, returnTo, linkUserId, as, now() + 600_000);
    setLoginCookie(c, config, state);
    return c.redirect(
      provider.authorizeUrl({ state, redirectUri: callbackUrl(provider.id), challenge: pkceChallenge(verifier), nonce, as: as ?? undefined }),
      302,
    );
  });

  app.get('/auth/:provider/callback', async (c) => {
    const providerId = c.req.param('provider') as ProviderId;
    const provider = providers.get(providerId);
    const state = c.req.query('state') ?? '';
    const row = db.prepare('SELECT * FROM login_states WHERE state = ?').get(state) as
      | { provider: string; verifier: string; nonce: string; return_to: string; link_user_id: string | null; expires_at: number }
      | undefined;
    if (row) db.prepare('DELETE FROM login_states WHERE state = ?').run(state);
    const cookie = getCookie(c, LOGIN_COOKIE) ?? '';
    clearLoginCookie(c, config);
    if (!provider || !row || row.provider !== providerId || row.expires_at < now() || !cookie || !safeEqual(cookie, state)) {
      return c.redirect(withParam(row?.return_to ?? '/me/', 'auth_error', 'expired'), 302);
    }
    const back = row.return_to;
    if (c.req.query('error')) return c.redirect(withParam(back, 'auth_error', 'denied'), 302);
    const code = c.req.query('code');
    if (!code) return c.redirect(withParam(back, 'auth_error', 'failed'), 302);

    let profile;
    try {
      profile = await provider.exchange({ code, redirectUri: callbackUrl(provider.id), verifier: row.verifier, nonce: row.nonce });
    } catch (err) {
      console.error(`sign-in with ${provider.id} failed:`, (err as Error).message);
      return c.redirect(withParam(back, 'auth_error', 'failed'), 302);
    }

    const current = c.get('user');
    if (row.link_user_id && current?.id === row.link_user_id) {
      const { merged } = linkIdentity(db, current.id, profile, now());
      return c.redirect(withParam(back, 'auth', merged ? 'merged' : 'linked'), 302);
    }
    const { user } = signIn(db, profile, now());
    endSession(db, c.get('sessionToken'));
    const s = createSession(db, user.id, now());
    setSessionCookies(c, config, s.token, s.expiresAt);
    return c.redirect(back, 302);
  });

  app.post('/auth/logout', sameOrigin, (c) => {
    endSession(db, c.get('sessionToken'));
    clearSessionCookies(c, config);
    return c.json({ ok: true });
  });

  // ---- profile -----------------------------------------------------------------------------

  app.get('/me', requireUser, (c) => c.json({ user: publicUser(c.get('user')!) }));

  app.patch('/me', sameOrigin, requireUser, async (c) => {
    const body = ProfileBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'invalid_body' }, 400);
    const user = c.get('user')!;
    renameUser(db, user.id, body.data.name, now());
    return c.json({ user: publicUser(getUser(db, user.id)!) });
  });

  app.delete('/me', sameOrigin, requireUser, (c) => {
    deleteUser(db, c.get('user')!.id);
    clearSessionCookies(c, config);
    return c.json({ ok: true });
  });

  // ---- progress ----------------------------------------------------------------------------

  app.get('/progress', requireUser, (c) => {
    const user = c.get('user')!;
    return c.json({ user: user.id, progress: readProgress(db, user.id) });
  });

  app.post('/progress', sameOrigin, requireUser, async (c) => {
    const body = ProgressBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'invalid_body' }, 400);
    const user = c.get('user')!;
    let skipped = 0;
    const changes = body.data.changes.flatMap((ch) => {
      const id = atlas.skillId(ch.id);
      if (!id) {
        skipped++;
        return [];
      }
      return [{ id, status: ch.status as (typeof STATUSES)[number], at: ch.at }];
    });
    const applied = writeChanges(db, user.id, changes, now());
    return c.json({ user: user.id, applied, skipped, progress: readProgress(db, user.id) });
  });

  // ---- agents connected through MCP --------------------------------------------------------

  app.get('/connections', requireUser, (c) => c.json({ connections: listGrants(db, c.get('user')!.id) }));

  app.delete('/connections/:id', sameOrigin, requireUser, (c) => {
    const ok = revokeGrant(db, c.get('user')!.id, c.req.param('id'));
    return ok ? c.json({ ok: true }) : c.json({ error: 'not_found' }, 404);
  });

  function callbackUrl(id: ProviderId) {
    return `${config.publicUrl}/api/auth/${id}/callback`;
  }

  function publicUser(u: User) {
    return {
      id: u.id,
      name: u.name,
      avatarUrl: u.avatar_url,
      createdAt: new Date(u.created_at).toISOString(),
      identities: identitiesOf(db, u.id).map((i) => ({ provider: i.provider, handle: i.handle, email: i.email, emailVerified: i.email_verified === 1 })),
    };
  }

  return app;
}

/** For the OAuth consent screen: who is signed in, if anyone. */
export function sessionUser(deps: Deps, c: Context): User | undefined {
  return readSession(deps.db, getCookie(c, SESSION_COOKIE), deps.now())?.user;
}
