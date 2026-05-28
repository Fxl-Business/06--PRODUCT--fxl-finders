/**
 * Phase 06 T04 — idempotency_key byte-match (D-N).
 *
 * The fxl-financiero sender computes idempotency_key inline as PLAIN sha256
 * (NOT HMAC). This test proves the inline form is byte-identical to Phase 05's
 * buildIdempotencyKey, and guards against re-introducing the deleted HMAC mistake.
 */
import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildIdempotencyKey } from '../../conversions/service.js';

const SOURCE = 'fxl-financiero';
const ORDER = 'org_abc';
const EVENT = 'sale';

/** EXACT inline form that ships in fxl-financiero notifyFxlFindersConversion. */
function idempotencyInline(source: string, externalOrderId: string, eventType: string) {
  return createHash('sha256').update(source + externalOrderId + eventType).digest('hex');
}

describe('idempotency_key byte-match vs Phase 05 buildIdempotencyKey (D-N)', () => {
  it('inline sha256 equals buildIdempotencyKey byte-for-byte', () => {
    expect(idempotencyInline(SOURCE, ORDER, EVENT)).toBe(
      buildIdempotencyKey(SOURCE, ORDER, EVENT),
    );
  });

  it('result is a 64-char lowercase hex string', () => {
    const key = buildIdempotencyKey(SOURCE, ORDER, EVENT);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  it('an HMAC value must NOT equal the sha256 value (guards the deleted mistake)', () => {
    const hmacValue = createHmac('sha256', '')
      .update(SOURCE + ORDER + EVENT)
      .digest('hex');
    expect(hmacValue).not.toBe(buildIdempotencyKey(SOURCE, ORDER, EVENT));
  });
});
