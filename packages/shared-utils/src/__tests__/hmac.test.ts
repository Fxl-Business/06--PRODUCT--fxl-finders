import { describe, expect, it } from 'vitest';
import {
  dailySalt,
  hashIp,
  signHmac,
  signReferralUrl,
  verifyHmac,
  verifyReferralSig,
} from '../hmac.js';

describe('signHmac', () => {
  it('returns a 64-char lowercase hex string (SHA-256 output)', () => {
    const sig = signHmac('secret', 'payload');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for identical (secret, payload)', () => {
    expect(signHmac('secret', 'payload')).toBe(signHmac('secret', 'payload'));
  });

  it('changes when the payload changes', () => {
    expect(signHmac('secret', 'a')).not.toBe(signHmac('secret', 'b'));
  });

  it('changes when the secret changes', () => {
    expect(signHmac('s1', 'payload')).not.toBe(signHmac('s2', 'payload'));
  });
});

describe('verifyHmac', () => {
  it('returns true for a matching signature', () => {
    expect(verifyHmac('secret', 'payload', signHmac('secret', 'payload'))).toBe(true);
  });

  it('returns false for a bad signature', () => {
    expect(verifyHmac('secret', 'payload', 'bad_sig')).toBe(false);
  });

  it('returns false for a signature made with a different secret', () => {
    expect(verifyHmac('secret', 'payload', signHmac('wrong_secret', 'payload'))).toBe(false);
  });

  it('returns false (not throw) when signature lengths differ', () => {
    expect(verifyHmac('secret', 'payload', 'short')).toBe(false);
  });
});

describe('signReferralUrl / verifyReferralSig (D-P)', () => {
  it('round-trips correctly', () => {
    const secret = 'whs_test';
    const clickId = '01hxyzclickid';
    const linkSig = signHmac(secret, ['finder', 'product', '100', '200'].join(':'));
    const fxlSig = signReferralUrl(secret, clickId, linkSig);
    expect(verifyReferralSig(secret, clickId, linkSig, fxlSig)).toBe(true);
  });

  it('uses the "." separator (byte-identical to D-P)', () => {
    const secret = 'whs_test';
    const expected = signHmac(secret, 'click.' + 'linksig');
    expect(signReferralUrl(secret, 'click', 'linksig')).toBe(expected);
  });

  it('fails verification when fxl_sig is tampered', () => {
    const secret = 'whs_test';
    const linkSig = 'linksig';
    expect(verifyReferralSig(secret, 'click', linkSig, 'tampered')).toBe(false);
  });
});

describe('hashIp', () => {
  it('returns a 16-char hex string', () => {
    expect(hashIp('1.2.3.4', 'salt')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic for identical (ip, salt)', () => {
    expect(hashIp('1.2.3.4', 'salt')).toBe(hashIp('1.2.3.4', 'salt'));
  });

  it('differs across salts (daily rotation privacy)', () => {
    expect(hashIp('1.2.3.4', 'salt-monday')).not.toBe(hashIp('1.2.3.4', 'salt-tuesday'));
  });
});

describe('dailySalt', () => {
  it('is deterministic for the same date + secret', () => {
    const d = new Date('2026-05-28T10:00:00Z');
    expect(dailySalt(d, 'secret')).toBe(dailySalt(d, 'secret'));
  });

  it('is stable within a UTC day (ignores the time portion)', () => {
    const morning = new Date('2026-05-28T01:00:00Z');
    const evening = new Date('2026-05-28T23:00:00Z');
    expect(dailySalt(morning, 'secret')).toBe(dailySalt(evening, 'secret'));
  });

  it('rotates across UTC days', () => {
    const day1 = new Date('2026-05-28T12:00:00Z');
    const day2 = new Date('2026-05-29T12:00:00Z');
    expect(dailySalt(day1, 'secret')).not.toBe(dailySalt(day2, 'secret'));
  });
});
