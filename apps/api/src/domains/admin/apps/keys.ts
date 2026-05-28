import { createHash, randomBytes } from 'node:crypto';

/**
 * App key generation utilities (Phase 02, T03).
 *
 * Three key types per the locked key-generation scheme:
 *   - Publishable key (pk_):  plaintext, safe to display anytime.
 *   - Secret key (sk_):       SHA-256 hashed at rest; plaintext shown ONCE.
 *   - Webhook signing secret (whs_): plaintext at rest (needed for HMAC at runtime).
 *
 * All generation uses Node's built-in `crypto` (randomBytes + createHash). No
 * third-party dependency. 32 random bytes → 64 hex chars.
 */

const RANDOM_BYTES = 32;

function randomHex(): string {
  return randomBytes(RANDOM_BYTES).toString('hex');
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** `pk_` + 64 hex chars (total length 67). Stored plaintext. */
export function generatePublishableKey(): string {
  return `pk_${randomHex()}`;
}

/**
 * Generates a secret-key triple. Plaintext (`sk_...`) is returned for the
 * reveal-once modal and never stored. `hash` (SHA-256 hex) and `prefix`
 * (`sk_xxxxxxx` shape) are what land in the DB.
 */
export function generateSecretKeyPair(): {
  plaintext: string;
  hash: string;
  prefix: string;
} {
  const plaintext = `sk_${randomHex()}`;
  const hash = sha256Hex(plaintext);
  // e.g. 'sk_a1b2cxxx' — first 8 chars of plaintext + 'xxx' masking marker.
  const prefix = `${plaintext.slice(0, 8)}xxx`;
  return { plaintext, hash, prefix };
}

/** `whs_` + 64 hex chars (total length 68). Stored plaintext (HMAC runtime). */
export function generateWebhookSigningSecret(): string {
  return `whs_${randomHex()}`;
}
