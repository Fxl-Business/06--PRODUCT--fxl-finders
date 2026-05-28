/**
 * Audit hash-chain unit tests (Phase 05 T04 — TDD, RED first).
 *
 * Covers canonicalJson (deterministic sorted-key serialization, D7),
 * computeEntryHash (sha256(prevHash || canonicalJson), D8 genesis), and
 * verifyChain (tamper detection across a chain).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalJson, computeEntryHash, verifyChain, type AuditChainRow } from '../service.js';

const GENESIS = '0'.repeat(64);

describe('canonicalJson (D7: alphabetical key sort, no whitespace)', () => {
  it('sorts keys alphabetically', () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });
  it('already-sorted stays the same', () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
  });
  it('handles null + string values', () => {
    expect(canonicalJson({ z: null, a: 'x' })).toBe('{"a":"x","z":null}');
  });
  it('empty object', () => {
    expect(canonicalJson({})).toBe('{}');
  });
});

describe('computeEntryHash (D8)', () => {
  it('returns a 64-char hex string', () => {
    const hash = computeEntryHash(GENESIS, { a: 1 });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('is deterministic', () => {
    expect(computeEntryHash(GENESIS, { a: 1 })).toBe(computeEntryHash(GENESIS, { a: 1 }));
  });
  it('changes when prevHash changes', () => {
    expect(computeEntryHash(GENESIS, { a: 1 })).not.toBe(computeEntryHash('f'.repeat(64), { a: 1 }));
  });
  it('changes when row changes', () => {
    expect(computeEntryHash(GENESIS, { a: 1 })).not.toBe(computeEntryHash(GENESIS, { a: 2 }));
  });
  it('matches the canonical sha256 formula', () => {
    const row = { b: 2, a: 1 };
    const expected = createHash('sha256')
      .update(GENESIS + '{"a":1,"b":2}')
      .digest('hex');
    expect(computeEntryHash(GENESIS, row)).toBe(expected);
  });
});

/** Builds a valid chain of N entries with the genesis prevHash convention. */
function buildChain(rows: Array<Record<string, unknown>>): AuditChainRow[] {
  const entries: AuditChainRow[] = [];
  let prevHash = GENESIS;
  for (const row of rows) {
    const entryHash = computeEntryHash(prevHash, row);
    entries.push({ ...row, prevHash, entryHash } as AuditChainRow);
    prevHash = entryHash;
  }
  return entries;
}

describe('verifyChain', () => {
  it('empty chain is valid', () => {
    expect(verifyChain([])).toEqual({ valid: true, brokenAt: null });
  });
  it('single correct entry is valid', () => {
    expect(verifyChain(buildChain([{ action: 'a' }]))).toEqual({ valid: true, brokenAt: null });
  });
  it('two-entry valid chain', () => {
    expect(verifyChain(buildChain([{ action: 'a' }, { action: 'b' }]))).toEqual({
      valid: true,
      brokenAt: null,
    });
  });
  it('detects a broken prev_hash link at index 1', () => {
    const chain = buildChain([{ action: 'a' }, { action: 'b' }]);
    chain[1]!.prevHash = 'f'.repeat(64); // tamper the link
    expect(verifyChain(chain)).toEqual({ valid: false, brokenAt: 1 });
  });
  it('detects a tampered entry_hash', () => {
    const chain = buildChain([{ action: 'a' }, { action: 'b' }, { action: 'c' }]);
    chain[2]!.entryHash = 'a'.repeat(64); // tamper the stored hash
    expect(verifyChain(chain).valid).toBe(false);
    expect(verifyChain(chain).brokenAt).toBe(2);
  });
});
