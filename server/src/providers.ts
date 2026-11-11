// Sign-in with GitHub and Google, including email and the provider's verification flag.
// GitHub's email endpoint also returns private addresses, unlike the public profile.
// Provider access tokens are used to read the profile and email, then dropped.
import type { Config } from './config.ts';
import type { Profile } from './users.ts';

export type ProviderId = 'github' | 'google' | 'dev';

export interface AuthorizeParams {
  state: string;
  redirectUri: string;
  challenge: string;
  nonce: string;
  /** dev provider only: which fake person to sign in as */
  as?: string;
}

export interface ExchangeParams {
  code: string;
  redirectUri: string;
  verifier: string;
  nonce: string;
}

export interface Provider {
  id: ProviderId;
  label: string;
  authorizeUrl(p: AuthorizeParams): string;
  exchange(p: ExchangeParams): Promise<Profile>;
}

export type Fetch = typeof fetch;

const UA = 'productengineer.pro';

async function readJson(res: Response, what: string): Promise<Record<string, unknown>> {
  const text = await res.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${what}: HTTP ${res.status}, not JSON`);
  }
  if (!res.ok || typeof body.error === 'string') {
    throw new Error(`${what}: HTTP ${res.status} ${String(body.error ?? '')} ${String(body.error_description ?? '')}`.trim());
  }
  return body;
}

export function github(c: NonNullable<Config['github']>, fetchFn: Fetch = fetch): Provider {
  return {
    id: 'github',
    label: 'GitHub',
    authorizeUrl({ state, redirectUri, challenge }) {
      const u = new URL('https://github.com/login/oauth/authorize');
      u.search = new URLSearchParams({
        client_id: c.clientId,
        redirect_uri: redirectUri,
        state,
        scope: 'user:email',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        allow_signup: 'true',
      }).toString();
      return u.href;
    },
    async exchange({ code, redirectUri, verifier }) {
      const token = await readJson(
        await fetchFn('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
          body: new URLSearchParams({
            client_id: c.clientId,
            client_secret: c.clientSecret,
            code,
            redirect_uri: redirectUri,
            code_verifier: verifier,
          }),
          signal: AbortSignal.timeout(10_000),
        }),
        'GitHub token',
      );
      const headers = {
        Authorization: `Bearer ${String(token.access_token)}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': UA,
      };
      const user = await readJson(
        await fetchFn('https://api.github.com/user', {
          headers,
          signal: AbortSignal.timeout(10_000),
        }),
        'GitHub user',
      );
      if (typeof user.id !== 'number') throw new Error('GitHub user: no id');
      const emails = await readJson(
        await fetchFn('https://api.github.com/user/emails?per_page=100', { headers, signal: AbortSignal.timeout(10_000) }),
        'GitHub emails',
      );
      if (!Array.isArray(emails)) throw new Error('GitHub emails: expected a list');
      const addresses = emails.filter(
        (e): e is { email: string; primary: boolean; verified: boolean } =>
          e !== null && typeof e === 'object' && typeof e.email === 'string' && !!e.email.trim(),
      );
      const email = addresses.find((e) => e.primary === true && e.verified === true)
        ?? addresses.find((e) => e.verified === true)
        ?? addresses.find((e) => e.primary === true)
        ?? addresses[0];
      return {
        provider: 'github',
        subject: String(user.id),
        name: typeof user.name === 'string' ? user.name : null,
        handle: typeof user.login === 'string' ? user.login : null,
        avatarUrl: typeof user.avatar_url === 'string' ? user.avatar_url : null,
        email: email?.email.trim() ?? null,
        emailVerified: email?.verified === true,
      };
    },
  };
}

export function google(c: NonNullable<Config['google']>, fetchFn: Fetch = fetch, now = () => Date.now()): Provider {
  return {
    id: 'google',
    label: 'Google',
    authorizeUrl({ state, redirectUri, challenge, nonce }) {
      const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      u.search = new URLSearchParams({
        client_id: c.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email',
        state,
        nonce,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      }).toString();
      return u.href;
    },
    async exchange({ code, redirectUri, verifier, nonce }) {
      const token = await readJson(
        await fetchFn('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: new URLSearchParams({
            client_id: c.clientId,
            client_secret: c.clientSecret,
            code,
            redirect_uri: redirectUri,
            code_verifier: verifier,
            grant_type: 'authorization_code',
          }),
          signal: AbortSignal.timeout(10_000),
        }),
        'Google token',
      );
      // The ID token comes straight from Google's token endpoint over TLS, so OpenID Connect
      // allows trusting it without checking the signature (Core 1.0, 3.1.3.7). The claims are
      // still checked.
      const claims = decodeJwt(String(token.id_token ?? ''));
      if (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') throw new Error('Google: bad issuer');
      if (claims.aud !== c.clientId) throw new Error('Google: bad audience');
      if (typeof claims.exp !== 'number' || claims.exp * 1000 < now()) throw new Error('Google: expired ID token');
      if (claims.nonce !== nonce) throw new Error('Google: nonce mismatch');
      if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('Google: no subject');
      const email = typeof claims.email === 'string' ? claims.email.trim() || null : null;
      return {
        provider: 'google',
        subject: claims.sub,
        name: typeof claims.name === 'string' ? claims.name : null,
        handle: null,
        avatarUrl: typeof claims.picture === 'string' ? claims.picture : null,
        email,
        emailVerified: email !== null && claims.email_verified === true,
      };
    },
  };
}

function decodeJwt(jwt: string): Record<string, unknown> {
  const part = jwt.split('.')[1];
  if (!part) throw new Error('Google: no ID token');
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

/**
 * Local development only (DEV_LOGIN=1 with a localhost PUBLIC_URL): signs in a fake person
 * without leaving the site, so the whole flow, including MCP authorization, can be tried and
 * tested without real OAuth apps.
 */
export function dev(): Provider {
  return {
    id: 'dev',
    label: 'Dev',
    authorizeUrl({ state, redirectUri, as }) {
      const u = new URL(redirectUri);
      u.searchParams.set('state', state);
      u.searchParams.set('code', `dev:${(as ?? 'dev').replace(/[^a-z0-9-]/gi, '').slice(0, 30) || 'dev'}`);
      return u.href;
    },
    async exchange({ code }) {
      const who = code.replace(/^dev:/, '');
      return { provider: 'dev', subject: who, name: `Dev ${who}`, handle: who, avatarUrl: null, email: null, emailVerified: false };
    },
  };
}

export function providersFrom(config: Config, fetchFn: Fetch = fetch): Map<ProviderId, Provider> {
  const out = new Map<ProviderId, Provider>();
  if (config.github) out.set('github', github(config.github, fetchFn));
  if (config.google) out.set('google', google(config.google, fetchFn));
  if (config.devLogin) out.set('dev', dev());
  return out;
}
