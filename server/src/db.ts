// SQLite through Node's built-in driver, so the server has no native module to compile.
// Stores provider identities (including email and its verification flag), a display name,
// an avatar URL and one status per skill. Provider ids remain the stable sign-in keys.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Db = DatabaseSync;

const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT,
    avatar_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- One row per sign-in method. subject is the provider's stable user id, never an email.
  CREATE TABLE identities (
    provider TEXT NOT NULL,
    subject TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    handle TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (provider, subject)
  );
  CREATE INDEX identities_user ON identities(user_id);

  CREATE TABLE sessions (
    id_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  -- A sign-in in flight: CSRF state, PKCE verifier and where to return.
  CREATE TABLE login_states (
    state TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    verifier TEXT NOT NULL,
    nonce TEXT NOT NULL,
    return_to TEXT NOT NULL,
    link_user_id TEXT,
    extra TEXT,
    expires_at INTEGER NOT NULL
  );

  -- status 'none' is kept as a tombstone, so clearing a skill on one device wins over an older
  -- 'learning' on another.
  CREATE TABLE progress (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('none', 'learning', 'comfortable')),
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, skill_id)
  );

  -- OAuth clients (MCP agents). kind 'cimd' is a Client ID Metadata Document cached from its URL;
  -- kind 'dcr' registered itself through Dynamic Client Registration.
  CREATE TABLE oauth_clients (
    client_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('cimd', 'dcr')),
    name TEXT,
    uri TEXT,
    redirect_uris TEXT NOT NULL,
    auth_method TEXT NOT NULL,
    secret_hash TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER
  );

  -- An authorization request waiting for the person to sign in and approve it.
  CREATE TABLE oauth_requests (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    state TEXT,
    code_challenge TEXT NOT NULL,
    scope TEXT NOT NULL,
    resource TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  -- One grant per person and client. Tokens hang off it; revoking a connection deletes it.
  CREATE TABLE oauth_grants (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL,
    client_name TEXT,
    scope TEXT NOT NULL,
    resource TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER,
    UNIQUE (user_id, client_id)
  );

  CREATE TABLE oauth_codes (
    code_hash TEXT PRIMARY KEY,
    grant_id TEXT NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE oauth_tokens (
    token_hash TEXT PRIMARY KEY,
    grant_id TEXT NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('access', 'refresh')),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX oauth_tokens_grant ON oauth_tokens(grant_id);
  `,
  `
  -- Existing identities acquire an email on their next provider sign-in or link.
  ALTER TABLE identities ADD COLUMN email TEXT;
  ALTER TABLE identities ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1));
  `,
  `
  -- Preserve existing choices while adding an explicit opt-out status.
  CREATE TABLE progress_next (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('none', 'learning', 'comfortable', 'not-interested')),
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, skill_id)
  );
  INSERT INTO progress_next SELECT user_id, skill_id, status, updated_at FROM progress;
  DROP TABLE progress;
  ALTER TABLE progress_next RENAME TO progress;
  `,
  `
  CREATE TABLE catalog_entries (
    id TEXT PRIMARY KEY,
    canonical_url TEXT NOT NULL UNIQUE,
    data TEXT NOT NULL CHECK (json_valid(data))
  );
  CREATE TABLE catalog_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL REFERENCES catalog_entries(id),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    note TEXT NOT NULL,
    at TEXT NOT NULL
  );
  CREATE INDEX catalog_events_entry ON catalog_events(entry_id, id);
  CREATE TABLE discovery_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    source TEXT NOT NULL,
    query TEXT NOT NULL,
    data TEXT NOT NULL CHECK (json_valid(data)),
    cost_usd REAL NOT NULL DEFAULT 0,
    at TEXT NOT NULL
  );
  `,
];

export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  migrate(db);
  return db;
}

function migrate(db: Db) {
  const { user_version: current } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let v = current; v < MIGRATIONS.length; v++) {
    tx(db, () => {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

/** Runs fn in a transaction. Nested calls join the outer one. */
export function tx<T>(db: Db, fn: () => T): T {
  if (db.isTransaction) return fn();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Deletes expired sessions, sign-ins, authorization requests, codes and tokens. */
export function sweep(db: Db, now = Date.now()) {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM login_states WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM oauth_requests WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM oauth_codes WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM oauth_tokens WHERE expires_at < ?').run(now);
  // grants whose every token expired and that nobody has used in 90 days
  db.prepare(
    `DELETE FROM oauth_grants WHERE id NOT IN (SELECT grant_id FROM oauth_tokens)
       AND COALESCE(last_used_at, created_at) < ?`,
  ).run(now - 90 * 86400_000);
  // self-registered clients that never got a grant within a day
  db.prepare(
    `DELETE FROM oauth_clients WHERE kind = 'dcr' AND created_at < ?
       AND client_id NOT IN (SELECT client_id FROM oauth_grants)`,
  ).run(now - 86400_000);
  db.prepare(`DELETE FROM oauth_clients WHERE kind = 'cimd' AND expires_at < ?`).run(now);
}
