import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  generatePublishableKey,
  generateSecretKeyPair,
  generateWebhookSigningSecret,
} from '../keys.js';

describe('keys — app key generation (Phase 02 T03)', () => {
  it('generatePublishableKey returns pk_ prefixed 67-char string', () => {
    const key = generatePublishableKey();
    expect(key.startsWith('pk_')).toBe(true);
    expect(key).toHaveLength(67); // 3 ('pk_') + 64 hex
  });

  it('generateSecretKeyPair returns { plaintext, hash, prefix } with sk_ plaintext', () => {
    const { plaintext, hash, prefix } = generateSecretKeyPair();
    expect(plaintext.startsWith('sk_')).toBe(true);
    expect(plaintext).toHaveLength(67);
    // hash is a 64-char SHA-256 hex digest
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    // round-trip: hash === sha256(plaintext)
    expect(hash).toBe(createHash('sha256').update(plaintext).digest('hex'));
    // prefix is the reveal-safe masked form
    expect(prefix.startsWith('sk_')).toBe(true);
    expect(prefix.endsWith('xxx')).toBe(true);
  });

  it('generateWebhookSigningSecret returns whs_ prefixed 68-char string', () => {
    const key = generateWebhookSigningSecret();
    expect(key.startsWith('whs_')).toBe(true);
    expect(key).toHaveLength(68); // 4 ('whs_') + 64 hex
  });

  it('all generators are non-deterministic (different on repeated calls)', () => {
    expect(generatePublishableKey()).not.toBe(generatePublishableKey());
    expect(generateSecretKeyPair().plaintext).not.toBe(generateSecretKeyPair().plaintext);
    expect(generateWebhookSigningSecret()).not.toBe(generateWebhookSigningSecret());
  });
});
