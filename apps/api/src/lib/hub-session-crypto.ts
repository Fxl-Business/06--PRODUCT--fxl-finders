import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const KEY_PATTERN = /^[0-9a-fA-F]{64}$/;
const ENVELOPE_VERSION = 'v1';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_ERROR =
  'FXL_HUB_SESSION_ENCRYPTION_KEY must be exactly 64 hexadecimal characters. Generate it with: openssl rand -hex 32';

export type HubSessionCipher = {
  encrypt(plaintext: string, sessionId: string): string;
  decrypt(envelope: string, sessionId: string): string;
};

function decodeBase64url(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Malformed Hub session ciphertext');
  }
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value) {
    throw new Error('Malformed Hub session ciphertext');
  }
  return decoded;
}

export function createHubSessionCipher(rawKey?: string): HubSessionCipher {
  if (!rawKey || !KEY_PATTERN.test(rawKey)) {
    throw new Error(KEY_ERROR);
  }
  const key = Buffer.from(rawKey, 'hex');

  return {
    encrypt(plaintext, sessionId) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(sessionId, 'utf8'));
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();

      return [
        ENVELOPE_VERSION,
        iv.toString('base64url'),
        authTag.toString('base64url'),
        ciphertext.toString('base64url'),
      ].join('.');
    },

    decrypt(envelope, sessionId) {
      const parts = envelope.split('.');
      if (parts.length !== 4 || parts[0] !== ENVELOPE_VERSION) {
        throw new Error('Malformed Hub session ciphertext');
      }
      const iv = decodeBase64url(parts[1] ?? '');
      const authTag = decodeBase64url(parts[2] ?? '');
      const ciphertext = decodeBase64url(parts[3] ?? '');
      if (iv.byteLength !== IV_BYTES || authTag.byteLength !== AUTH_TAG_BYTES) {
        throw new Error('Malformed Hub session ciphertext');
      }

      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(Buffer.from(sessionId, 'utf8'));
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    },
  };
}
