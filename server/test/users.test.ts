import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db.ts';
import { createSession, deleteUser, identitiesOf, linkIdentity, readProgress, readSession, signIn, writeChanges, type Profile } from '../src/users.ts';

const alice: Profile = { provider: 'github', subject: '42', name: 'Alice', handle: 'alice', avatarUrl: null, email: 'alice@example.com', emailVerified: true };
const google: Profile = { ...alice, provider: 'google', subject: 'google-42', handle: null, email: 'alice@work.example' };

test('email refreshes with the stable provider id, and matching emails do not merge accounts', () => {
  const db = openDb(':memory:');
  try {
    const { user } = signIn(db, alice);
    const changed = signIn(db, { ...alice, email: 'new@example.com', emailVerified: false });
    assert.equal(changed.user.id, user.id);
    assert.equal(changed.created, false);
    assert.equal(identitiesOf(db, user.id)[0].email, 'new@example.com');
    assert.equal(identitiesOf(db, user.id)[0].email_verified, 0);
    const sameEmail = signIn(db, { ...google, email: 'new@example.com' });
    assert.notEqual(sameEmail.user.id, user.id);
    signIn(db, { ...alice, email: null, emailVerified: true });
    assert.equal(identitiesOf(db, user.id)[0].email, null);
    assert.equal(identitiesOf(db, user.id)[0].email_verified, 0);
  } finally { db.close(); }
});

test('linking and merging keep both provider emails and refresh the identity being linked', () => {
  const db = openDb(':memory:');
  try {
    const { user } = signIn(db, alice);
    linkIdentity(db, user.id, google);
    linkIdentity(db, user.id, { ...google, email: 'updated@work.example', emailVerified: false });
    assert.deepEqual(identitiesOf(db, user.id).map((i) => [i.email, i.email_verified]), [['alice@example.com', 1], ['updated@work.example', 0]]);

    const { user: other } = signIn(db, { ...alice, subject: 'other', email: 'other@example.com' });
    const session = createSession(db, other.id);
    const { merged } = linkIdentity(db, user.id, { ...alice, subject: 'other', email: 'refreshed@example.com' });
    assert.equal(merged, true);
    assert.equal(readSession(db, session.token)?.user.id, user.id);
    const addresses = identitiesOf(db, user.id).map((i) => i.email).sort();
    assert.deepEqual(addresses, ['alice@example.com', 'refreshed@example.com', 'updated@work.example']);
    assert.deepEqual(identitiesOf(db, other.id), []);
    deleteUser(db, user.id);
    assert.deepEqual(db.prepare('SELECT email FROM identities').all(), []);
  } finally { db.close(); }
});

test('an existing version 1 database migrates without losing accounts, sessions or progress', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pe-email-migration-'));
  const path = join(directory, 'account.sqlite');
  let db = openDb(path);
  try {
    const { user } = signIn(db, { ...alice, email: null, emailVerified: false });
    const session = createSession(db, user.id);
    writeChanges(db, user.id, [{ id: 'sample-size', status: 'learning', at: 1 }]);
    // Recreate the previous schema, before email columns existed.
    db.exec('ALTER TABLE identities DROP COLUMN email; ALTER TABLE identities DROP COLUMN email_verified; PRAGMA user_version = 1;');
    db.close();
    db = openDb(path);
    assert.equal(identitiesOf(db, user.id)[0].email, null);
    assert.equal(identitiesOf(db, user.id)[0].email_verified, 0);
    assert.equal(readSession(db, session.token)?.user.id, user.id);
    assert.equal(readProgress(db, user.id)['sample-size'].status, 'learning');
    assert.equal(signIn(db, alice).user.id, user.id);
    assert.equal(identitiesOf(db, user.id)[0].email, alice.email);
    db.close();
    db = openDb(path);
    assert.equal(identitiesOf(db, user.id)[0].email, alice.email);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('an existing progress table migrates to support opting out without losing choices', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pe-progress-migration-'));
  const path = join(directory, 'account.sqlite');
  let db = openDb(path);
  try {
    const { user } = signIn(db, alice);
    const session = createSession(db, user.id);
    writeChanges(db, user.id, [
      { id: 'sample-size', status: 'learning', at: 1 },
      { id: 'funnel-analysis', status: 'comfortable', at: 2 },
      { id: 'ab-tests', status: 'none', at: 3 },
    ]);
    db.exec(`
      CREATE TABLE progress_previous (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        skill_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('none', 'learning', 'comfortable')),
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, skill_id)
      );
      INSERT INTO progress_previous SELECT * FROM progress;
      DROP TABLE progress;
      ALTER TABLE progress_previous RENAME TO progress;
      PRAGMA user_version = 2;
    `);
    db.close();
    db = openDb(path);
    assert.equal(readSession(db, session.token)?.user.id, user.id);
    assert.equal(readProgress(db, user.id)['sample-size'].status, 'learning');
    assert.equal(readProgress(db, user.id)['funnel-analysis'].status, 'comfortable');
    assert.equal(db.prepare("SELECT status FROM progress WHERE skill_id = 'ab-tests'").get()?.status, 'none');
    writeChanges(db, user.id, [{ id: 'sample-size', status: 'not-interested', at: 4 }]);
    db.close();
    db = openDb(path);
    assert.equal(readProgress(db, user.id)['sample-size'].status, 'not-interested');
    deleteUser(db, user.id);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM progress').get()?.count, 0);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
