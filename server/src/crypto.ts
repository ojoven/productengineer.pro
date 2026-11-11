import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** A random, URL-safe secret. 32 bytes is 256 bits. */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** Short random id for rows that are not secrets (users, grants). */
export const randomId = () => randomBytes(12).toString('base64url');

/** Tokens, codes and session ids are stored only as hashes. */
export const hash = (value: string) => createHash('sha256').update(value).digest('base64url');

/** PKCE S256: BASE64URL(SHA256(verifier)). */
export const pkceChallenge = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
