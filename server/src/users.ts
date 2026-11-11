// People, their sign-in identities, browser sessions and skill progress.
import { tx, type Db } from './db.ts';
import { hash, randomId, randomToken } from './crypto.ts';

// Keep the API deployable from server/ alone; these values match the browser's status.ts.
export type Status = 'none' | 'learning' | 'comfortable' | 'not-interested';
export const STATUSES: readonly Status[] = ['none', 'learning', 'comfortable', 'not-interested'];

export interface User {
  id: string;
  name: string | null;
  avatar_url: string | null;
  created_at: number;
}

export interface Profile {
  provider: string;
  subject: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  email: string | null;
  emailVerified: boolean;
}

export const SESSION_TTL = 180 * 86400_000;

export function getUser(db: Db, id: string): User | undefined {
  return db.prepare('SELECT id, name, avatar_url, created_at FROM users WHERE id = ?').get(id) as User | undefined;
}

export function identitiesOf(db: Db, userId: string) {
  return db.prepare('SELECT provider, handle, email, email_verified, created_at FROM identities WHERE user_id = ? ORDER BY created_at').all(userId) as {
    provider: string;
    handle: string | null;
    email: string | null;
    email_verified: number;
    created_at: number;
  }[];
}

/** Finds the person behind a provider identity, or creates them. */
export function signIn(db: Db, p: Profile, now = Date.now()): { user: User; created: boolean } {
  return tx(db, () => {
    const found = db.prepare('SELECT user_id FROM identities WHERE provider = ? AND subject = ?').get(p.provider, p.subject) as
      | { user_id: string }
      | undefined;
    if (found) {
      refreshIdentity(db, p);
      if (p.avatarUrl) db.prepare('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?').run(p.avatarUrl, now, found.user_id);
      return { user: getUser(db, found.user_id)!, created: false };
    }
    const id = randomId();
    db.prepare('INSERT INTO users (id, name, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
      id,
      cleanName(p.name ?? p.handle),
      p.avatarUrl,
      now,
      now,
    );
    insertIdentity(db, id, p, now);
    return { user: getUser(db, id)!, created: true };
  });
}

/**
 * Adds a sign-in method to a signed-in person. If that identity already belongs to another
 * account (someone signed in with GitHub on one device and Google on another), the two accounts
 * are merged into this one: identities move over and progress merges, newest change winning.
 */
export function linkIdentity(db: Db, userId: string, p: Profile, now = Date.now()): { merged: boolean } {
  return tx(db, () => {
    const found = db.prepare('SELECT user_id FROM identities WHERE provider = ? AND subject = ?').get(p.provider, p.subject) as
      | { user_id: string }
      | undefined;
    if (found?.user_id === userId) {
      refreshIdentity(db, p);
      return { merged: false };
    }
    if (!found) {
      insertIdentity(db, userId, p, now);
      return { merged: false };
    }
    const other = found.user_id;
    const rows = db.prepare('SELECT skill_id, status, updated_at FROM progress WHERE user_id = ?').all(other) as {
      skill_id: string;
      status: Status;
      updated_at: number;
    }[];
    writeChanges(db, userId, rows.map((r) => ({ id: r.skill_id, status: r.status, at: r.updated_at })), now);
    db.prepare('UPDATE identities SET user_id = ? WHERE user_id = ?').run(userId, other);
    refreshIdentity(db, p);
    // the other device stays signed in, now to the merged account, and its agents keep working
    db.prepare('UPDATE sessions SET user_id = ? WHERE user_id = ?').run(userId, other);
    db.prepare('UPDATE OR IGNORE oauth_grants SET user_id = ? WHERE user_id = ?').run(userId, other);
    const me = getUser(db, userId)!;
    const them = getUser(db, other)!;
    if (!me.name && them.name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(them.name, userId);
    if (!me.avatar_url && them.avatar_url) db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(them.avatar_url, userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(other);
    return { merged: true };
  });
}

function insertIdentity(db: Db, userId: string, p: Profile, now: number) {
  db.prepare('INSERT INTO identities (provider, subject, user_id, handle, email, email_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(p.provider, p.subject, userId, p.handle, p.email, p.email !== null && p.emailVerified ? 1 : 0, now);
}

function refreshIdentity(db: Db, p: Profile) {
  db.prepare('UPDATE identities SET handle = ?, email = ?, email_verified = ? WHERE provider = ? AND subject = ?')
    .run(p.handle, p.email, p.email !== null && p.emailVerified ? 1 : 0, p.provider, p.subject);
}

export function cleanName(name: string | null | undefined): string | null {
  const n = (name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return n || null;
}

export function renameUser(db: Db, id: string, name: string | null, now = Date.now()) {
  db.prepare('UPDATE users SET name = ?, updated_at = ? WHERE id = ?').run(cleanName(name), now, id);
}

/** Deletes the person and everything attached: identities, sessions, progress, agent grants. */
export function deleteUser(db: Db, id: string) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

// ---- sessions ------------------------------------------------------------------------------

export function createSession(db: Db, userId: string, now = Date.now()): { token: string; expiresAt: number } {
  const token = randomToken();
  const expiresAt = now + SESSION_TTL;
  db.prepare('INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(hash(token), userId, now, expiresAt);
  return { token, expiresAt };
}

/** The session's user, sliding the expiry forward once a day at most. */
export function readSession(db: Db, token: string | undefined, now = Date.now()): { user: User; expiresAt: number; renewed: boolean } | undefined {
  if (!token || token.length > 100) return undefined;
  const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE id_hash = ?').get(hash(token)) as
    | { user_id: string; expires_at: number }
    | undefined;
  if (!row || row.expires_at < now) return undefined;
  const user = getUser(db, row.user_id);
  if (!user) return undefined;
  let expiresAt = row.expires_at;
  let renewed = false;
  if (expiresAt - now < SESSION_TTL - 86400_000) {
    expiresAt = now + SESSION_TTL;
    db.prepare('UPDATE sessions SET expires_at = ? WHERE id_hash = ?').run(expiresAt, hash(token));
    renewed = true;
  }
  return { user, expiresAt, renewed };
}

export function endSession(db: Db, token: string | undefined) {
  if (token) db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(hash(token));
}

// ---- progress ------------------------------------------------------------------------------

export interface Change {
  id: string;
  status: Status;
  /** When the change was made, in ms since epoch. */
  at: number;
}

/**
 * Applies changes with last-write-wins per skill. A change older than what is stored is ignored.
 * Times in the future are clamped to now, so a device with a fast clock cannot pin a status.
 */
export function writeChanges(db: Db, userId: string, changes: Change[], now = Date.now()): number {
  const read = db.prepare('SELECT updated_at FROM progress WHERE user_id = ? AND skill_id = ?');
  const write = db.prepare(
    `INSERT INTO progress (user_id, skill_id, status, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, skill_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
  );
  let applied = 0;
  tx(db, () => {
    for (const c of changes) {
      const at = Math.min(Math.max(0, Math.floor(c.at)), now);
      const current = read.get(userId, c.id) as { updated_at: number } | undefined;
      if (current && current.updated_at > at) continue;
      write.run(userId, c.id, c.status, at);
      applied++;
    }
  });
  return applied;
}

/** Current statuses, without cleared skills. */
export function readProgress(db: Db, userId: string): Record<string, { status: Exclude<Status, 'none'>; at: number }> {
  const rows = db.prepare(`SELECT skill_id, status, updated_at FROM progress WHERE user_id = ? AND status != 'none'`).all(userId) as {
    skill_id: string;
    status: Exclude<Status, 'none'>;
    updated_at: number;
  }[];
  return Object.fromEntries(rows.map((r) => [r.skill_id, { status: r.status, at: r.updated_at }]));
}
