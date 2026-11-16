// Keeps this browser's progress and the account in step, when someone is signed in.
//
// - Visitors without an account never call the API: the readable `pe_auth` cookie says
//   whether a session exists.
// - The first time a browser sees a session, everything it has locally is uploaded. The server
//   keeps the newest change per skill, so a stale laptop cannot overwrite newer work.
// - After that, each change is queued, sent shortly after, and kept until the server has it,
//   so changes made offline go out later. Pages pull the account's state when they open or come
//   back into view.
import { forgetLocal, load, replaceFromAccount, type Change } from './progress.ts';
import type { Status } from '../atlas/render.ts';

const KEY = 'pe-sync:v1';

export interface Account {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  identities: { provider: string; handle: string | null; email: string | null; emailVerified: boolean }[];
}

interface State {
  account?: Account;
  pending: Record<string, { status: Status | 'none'; at: number }>;
  pulledAt?: number;
}

type ServerProgress = Record<string, { status: Status; at: number }>;

export const isSignedIn = () => /(?:^|;\s*)pe_auth=1(?:;|$)/.test(document.cookie);

function read(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s && typeof s === 'object' && s.pending && typeof s.pending === 'object') return s as State;
  } catch {
    /* blocked or corrupt */
  }
  return { pending: {} };
}

function write(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: sync lasts for this page */
  }
}

export const account = () => (isSignedIn() ? read().account : undefined);

function announce() {
  document.documentElement.classList.toggle('signed-in', isSignedIn());
  window.dispatchEvent(new CustomEvent('pe:account'));
}

async function api(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  const res = await fetch(path, { ...init, headers, body, credentials: 'same-origin' });
  if (res.status === 401) dropSession();
  return res;
}

/** The session is gone (expired, signed out elsewhere, account deleted). Local progress stays. */
function dropSession() {
  document.cookie = 'pe_auth=; Max-Age=0; Path=/';
  write({ pending: {} });
  announce();
}

const pendingList = (s: State): Change[] => Object.entries(s.pending).map(([id, v]) => ({ id, status: v.status, at: v.at }));

/** Writes the account's state locally, unless it belongs to someone else than we thought. */
async function adopt(user: string, progress: ServerProgress) {
  let s = read();
  if (s.account && s.account.id !== user) {
    // signed in as a different person: their map replaces this one, nothing is merged
    s = { pending: {} };
    write(s);
    await refreshAccount();
  }
  replaceFromAccount(progress, pendingList(read()));
}

let flushing: Promise<void> | undefined;
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleFlush(ms = 400) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush(), ms);
}

async function flush(): Promise<void> {
  if (flushing) {
    await flushing;
    if (Object.keys(read().pending).length) scheduleFlush(0);
    return;
  }
  flushing = (async () => {
    const sent = read().pending;
    const changes = Object.entries(sent).map(([id, v]) => ({ id, status: v.status, at: v.at }));
    if (!changes.length || !isSignedIn()) return;
    let res: Response;
    try {
      res = await api('/api/progress', { method: 'POST', json: { changes } });
    } catch {
      return; // offline: kept for the next try
    }
    if (!res.ok) return;
    const body = (await res.json()) as { user: string; progress: ServerProgress };
    const s = read();
    // drop what the server now has; a change made while the request was in flight stays
    for (const [id, v] of Object.entries(sent)) if (s.pending[id]?.at === v.at) delete s.pending[id];
    s.pulledAt = Date.now();
    write(s);
    await adopt(body.user, body.progress);
  })();
  try {
    await flushing;
  } finally {
    flushing = undefined;
  }
}

async function pull() {
  if (!isSignedIn()) return;
  if (Object.keys(read().pending).length) return flush();
  let res: Response;
  try {
    res = await api('/api/progress');
  } catch {
    return;
  }
  if (!res.ok) return;
  const body = (await res.json()) as { user: string; progress: ServerProgress };
  const s = read();
  s.pulledAt = Date.now();
  write(s);
  await adopt(body.user, body.progress);
}

async function refreshAccount(): Promise<Account | undefined> {
  try {
    const res = await api('/api/me');
    if (!res.ok) return undefined;
    const { user } = (await res.json()) as { user: Account };
    const s = read();
    s.account = user;
    write(s);
    announce();
    return user;
  } catch {
    return undefined;
  }
}

/** First time this browser sees the session: upload everything it has, then take the result. */
async function firstSync() {
  const local = load();
  const fallback = local.updated ? Date.parse(local.updated) || 0 : 0;
  const s = read();
  for (const [id, status] of Object.entries(local.progress)) {
    if (!s.pending[id]) s.pending[id] = { status, at: local.at?.[id] ?? fallback };
  }
  write(s);
  const user = await refreshAccount();
  if (!user) return;
  if (Object.keys(read().pending).length) await flush();
  else await pull();
}

let started = false;

export function startSync() {
  if (started) return;
  started = true;
  announce();

  window.addEventListener('pe:local-change', (e) => {
    if (!isSignedIn()) return;
    const s = read();
    for (const c of (e as CustomEvent<Change[]>).detail) s.pending[c.id] = { status: c.status, at: c.at };
    write(s);
    scheduleFlush();
  });

  const check = () => {
    if (isSignedIn()) {
      const s = read();
      if (!s.account) void firstSync();
      else if (!s.pulledAt || Date.now() - s.pulledAt > 15_000 || Object.keys(s.pending).length) void pull();
    } else if (read().account) {
      dropSession();
    }
  };
  check();
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
  window.addEventListener('online', () => void flush());
  window.addEventListener('storage', (e) => e.key === KEY && announce());
}

// ---- account actions, used by the profile and connect pages ----------------------------------

export function signInUrl(provider: string, opts: { returnTo?: string; link?: boolean } = {}) {
  const q = new URLSearchParams({ return: opts.returnTo ?? location.pathname + location.search + location.hash });
  if (opts.link) q.set('link', '1');
  return `/api/auth/${encodeURIComponent(provider)}/start?${q}`;
}

export async function providers(): Promise<{ id: string; label: string }[]> {
  try {
    const res = await fetch('/api/auth/providers');
    return res.ok ? ((await res.json()) as { providers: { id: string; label: string }[] }).providers : [];
  } catch {
    return [];
  }
}

/** Signs out and drops this browser's copy; the map stays in the account. */
export async function signOut() {
  await flush().catch(() => {});
  await api('/api/auth/logout', { method: 'POST', json: {} }).catch(() => {});
  document.cookie = 'pe_auth=; Max-Age=0; Path=/';
  write({ pending: {} });
  forgetLocal();
  announce();
}

/** Deletes the account and its copy of the map. This browser keeps its own copy. */
export async function deleteAccount(): Promise<boolean> {
  const res = await api('/api/me', { method: 'DELETE' });
  if (!res.ok) return false;
  document.cookie = 'pe_auth=; Max-Age=0; Path=/';
  write({ pending: {} });
  announce();
  return true;
}

export async function rename(name: string): Promise<boolean> {
  const res = await api('/api/me', { method: 'PATCH', json: { name: name.trim() || null } });
  if (!res.ok) return false;
  const { user } = (await res.json()) as { user: Account };
  const s = read();
  s.account = user;
  write(s);
  announce();
  return true;
}

export { refreshAccount };

export interface Connection {
  id: string;
  name: string;
  verifiedDomain: string | null;
  uri: string | null;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

export async function connections(): Promise<Connection[]> {
  try {
    const res = await api('/api/connections');
    return res.ok ? ((await res.json()) as { connections: Connection[] }).connections : [];
  } catch {
    return [];
  }
}

export async function revokeConnection(id: string): Promise<boolean> {
  const res = await api(`/api/connections/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return res.ok;
}
