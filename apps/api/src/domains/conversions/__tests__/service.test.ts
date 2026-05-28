/**
 * Conversion ingest unit tests (Phase 05 T05 — TDD, RED first).
 *
 * Pure-function + Zod coverage: resolveAttribution (last-touch within window),
 * buildIdempotencyKey (sha256, D-N — Phase 06 byte-matches it), hashCustomerEmail,
 * and WebhookBodySchema (D-M one field set incl. finder_code + PII).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  WebhookBodySchema,
  buildIdempotencyKey,
  hashCustomerEmail,
  resolveAttribution,
} from '../service.js';

const DAY = 86400000;

function click(id: string, createdAt: Date) {
  return { clickId: id, linkId: 'link-' + id, createdAt } as Parameters<typeof resolveAttribution>[0][number];
}

describe('resolveAttribution (last-touch within window)', () => {
  const closedAt = new Date('2026-05-28T12:00:00Z');

  it('returns the most recent click within the window', () => {
    const clicks = [
      click('a', new Date(closedAt.getTime() - 5 * DAY)),
      click('b', new Date(closedAt.getTime() - 1 * DAY)),
      click('c', new Date(closedAt.getTime() - 20 * DAY)),
    ];
    expect(resolveAttribution(clicks, closedAt, 30)?.clickId).toBe('b');
  });

  it('returns null when no clicks are within the window', () => {
    const clicks = [click('old', new Date(closedAt.getTime() - 40 * DAY))];
    expect(resolveAttribution(clicks, closedAt, 30)).toBeNull();
  });

  it('returns null for an empty clicks array', () => {
    expect(resolveAttribution([], closedAt, 30)).toBeNull();
  });

  it('inclusive window start: click exactly at closedAt - windowDays is included', () => {
    const clicks = [click('edge', new Date(closedAt.getTime() - 30 * DAY))];
    expect(resolveAttribution(clicks, closedAt, 30)?.clickId).toBe('edge');
  });
});

describe('buildIdempotencyKey (D-N: sha256(source+orderId+eventType))', () => {
  it('returns a 64-char hex string', () => {
    expect(buildIdempotencyKey('fxl-financiero', 'ord-1', 'sale')).toMatch(/^[a-f0-9]{64}$/);
  });
  it('is deterministic', () => {
    expect(buildIdempotencyKey('fxl-financiero', 'ord-1', 'sale')).toBe(
      buildIdempotencyKey('fxl-financiero', 'ord-1', 'sale'),
    );
  });
  it('changes when any input changes', () => {
    const base = buildIdempotencyKey('fxl-financiero', 'ord-1', 'sale');
    expect(buildIdempotencyKey('fxl-financiero', 'ord-2', 'sale')).not.toBe(base);
    expect(buildIdempotencyKey('fxl-financiero', 'ord-1', 'refund')).not.toBe(base);
  });
  it('byte-matches the plain sha256 formula (Phase 06 cross-repo invariant)', () => {
    const expected = createHash('sha256')
      .update('fxl-financiero' + 'ord-1' + 'sale')
      .digest('hex');
    expect(buildIdempotencyKey('fxl-financiero', 'ord-1', 'sale')).toBe(expected);
  });
});

describe('hashCustomerEmail', () => {
  it('= sha256(email + orgId)', () => {
    const expected = createHash('sha256').update('a@b.com' + 'org-1').digest('hex');
    expect(hashCustomerEmail('a@b.com', 'org-1')).toBe(expected);
  });
  it('is org-salted (different org → different hash)', () => {
    expect(hashCustomerEmail('a@b.com', 'org-1')).not.toBe(hashCustomerEmail('a@b.com', 'org-2'));
  });
});

describe('WebhookBodySchema (D-M one field set)', () => {
  const valid = {
    source: 'fxl-financiero',
    external_order_id: 'ord-1',
    event_type: 'sale',
    idempotency_key: 'k',
    click_id: 'clk_123',
    seller_clerk_id: null,
    customer_email: 'a@b.com',
    customer_name: 'Alice',
    customer_phone: '+5511999999999',
    customer_cpf: '12345678901',
    customer_org_id: null,
    realized_setup_brl: 100000,
    realized_monthly_brl: 10700,
    closed_at: '2026-05-28T12:00:00.000Z',
  };

  it('accepts a valid body', () => {
    expect(WebhookBodySchema.safeParse(valid).success).toBe(true);
  });

  it('accepts click_id null + finder_code fallback', () => {
    const r = WebhookBodySchema.safeParse({ ...valid, click_id: null, finder_code: 'ABC123' });
    expect(r.success).toBe(true);
  });

  it('accepts both click_id and finder_code omitted (attribution resolved at ingest, not Zod)', () => {
    const r = WebhookBodySchema.safeParse({ ...valid, click_id: null });
    expect(r.success).toBe(true);
  });

  it('rejects a missing required field', () => {
    const rest = { ...valid } as Partial<typeof valid>;
    delete rest.external_order_id;
    expect(WebhookBodySchema.safeParse(rest).success).toBe(false);
  });

  it('rejects an event_type not in [sale, refund]', () => {
    expect(WebhookBodySchema.safeParse({ ...valid, event_type: 'cancel' }).success).toBe(false);
  });

  it('rejects a negative realized_setup_brl', () => {
    expect(WebhookBodySchema.safeParse({ ...valid, realized_setup_brl: -1 }).success).toBe(false);
  });

  it('keeps the PII fields (customer_name/phone/cpf) for the leads row', () => {
    const parsed = WebhookBodySchema.parse(valid);
    expect(parsed.customer_name).toBe('Alice');
    expect(parsed.customer_phone).toBe('+5511999999999');
    expect(parsed.customer_cpf).toBe('12345678901');
  });
});
