/**
 * HMAC / hashing utilities (Phase 04, D2 + plan-brief D-O / D-P).
 *
 * Single source of truth for HMAC sign/verify. Phase 05's webhook handler
 * imports `verifyHmac`; the /r/[code] redirect handler imports
 * `signReferralUrl`, `hashIp`, `dailySalt`. Node built-in `crypto` ONLY - no
 * third-party dependency, so this resolves identically in Hono and Node.
 *
 * INVARIANT (D-O): sign and verify operate over the IDENTICAL raw byte string.
 * For webhooks `payload = ts + "." + rawBody`. For referral URLs the `fxl_sig`
 * is `hmac(click_id + "." + link.signature, secret)` (D-P) - the "." separator
 * is mandatory and byte-identical.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Computes HMAC-SHA256(secret, payload) and returns a lowercase hex string
 * (64 chars). Deterministic for identical (secret, payload).
 */
export function signHmac(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verifies an expected signature against a freshly computed HMAC using a
 * constant-time compare (timingSafeEqual). Returns false (without throwing) if
 * the lengths differ, so a length mismatch cannot leak timing information and
 * cannot crash on the Buffer length-assert inside timingSafeEqual.
 */
export function verifyHmac(secret: string, payload: string, expectedSig: string): boolean {
  const computed = signHmac(secret, payload);
  const computedBuf = Buffer.from(computed, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (computedBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(computedBuf, expectedBuf);
}

/**
 * Convenience wrapper producing the `fxl_sig` appended to a referral redirect
 * URL (D-P): `hmac(click_id + "." + link.signature, webhook_signing_secret)`.
 */
export function signReferralUrl(
  webhookSigningSecret: string,
  clickId: string,
  linkSignature: string,
): string {
  return signHmac(webhookSigningSecret, clickId + '.' + linkSignature);
}

/**
 * Verifies a referral `?fxl_sig` param (used by sibling apps when fxl_sig
 * verification is enabled - deferred in v1.0 per D-P, formula pinned here).
 */
export function verifyReferralSig(
  webhookSigningSecret: string,
  clickId: string,
  linkSignature: string,
  sig: string,
): boolean {
  return verifyHmac(webhookSigningSecret, clickId + '.' + linkSignature, sig);
}

/**
 * Privacy-preserving IP hash (D5): first 16 hex chars of sha256(ip + dailySalt).
 * Pair with `dailySalt` so the same IP hashes differently across days.
 */
export function hashIp(ip: string, dailySaltValue: string): string {
  return createHash('sha256')
    .update(ip + dailySaltValue)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Produces the daily-rotating salt: sha256(YYYY-MM-DD + HASH_SALT_SECRET).
 * Date is reduced to its ISO date portion so the salt is stable within a UTC
 * day and rotates at the UTC day boundary.
 */
export function dailySalt(date: Date, hashSaltSecret: string): string {
  const day = date.toISOString().slice(0, 10);
  return createHash('sha256')
    .update(day + hashSaltSecret)
    .digest('hex');
}
