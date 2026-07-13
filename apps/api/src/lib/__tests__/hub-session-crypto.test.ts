import { describe, expect, it } from 'vitest';
import { createHubSessionCipher } from '../hub-session-crypto.js';

const VALID_KEY = '0123456789abcdef'.repeat(4);

describe('createHubSessionCipher', () => {
  it('encrypts and decrypts a refresh token with a 64-character hexadecimal key', () => {
    const cipher = createHubSessionCipher(VALID_KEY);

    const envelope = cipher.encrypt('rt-round-trip', 'session-1');

    expect(cipher.decrypt(envelope, 'session-1')).toBe('rt-round-trip');
  });

  it('never includes the plaintext refresh token in ciphertext', () => {
    const cipher = createHubSessionCipher(VALID_KEY);
    const plaintext = 'rt-plaintext-secret';

    const envelope = cipher.encrypt(plaintext, 'session-1');

    expect(envelope).not.toBe(plaintext);
    expect(envelope).not.toContain(plaintext);
  });

  it('uses a fresh initialization vector for each encryption', () => {
    const cipher = createHubSessionCipher(VALID_KEY);

    const first = cipher.encrypt('rt-same', 'session-1');
    const second = cipher.encrypt('rt-same', 'session-1');

    expect(first).not.toBe(second);
  });

  it('rejects tampering, different authenticated session ids, and malformed ciphertext', () => {
    const cipher = createHubSessionCipher(VALID_KEY);
    const envelope = cipher.encrypt('rt-authenticated', 'session-1');
    const last = envelope.at(-1) ?? 'A';
    const tampered = `${envelope.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`;

    expect(() => cipher.decrypt(tampered, 'session-1')).toThrow();
    expect(() => cipher.decrypt(envelope, 'session-2')).toThrow();
    expect(() => cipher.decrypt('not-an-envelope', 'session-1')).toThrow();
  });

  it.each([undefined, '', 'abcd', 'g'.repeat(64)])(
    'rejects an invalid encryption key and names the generation command',
    (invalidKey) => {
      expect(() => createHubSessionCipher(invalidKey)).toThrow(
        /FXL_HUB_SESSION_ENCRYPTION_KEY.*openssl rand -hex 32/,
      );
    },
  );
});
