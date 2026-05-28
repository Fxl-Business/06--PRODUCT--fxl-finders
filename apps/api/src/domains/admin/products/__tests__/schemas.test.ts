import { describe, expect, it } from 'vitest';
import { UpsertCommissionRuleSchema, UpsertPriceBandSchema } from '../service.js';

describe('UpsertPriceBandSchema — min<=list<=max boundary matrix (Phase 02 T05, WARN/TDD)', () => {
  it('ACCEPTS min < list < max', () => {
    const r = UpsertPriceBandSchema.safeParse({
      component: 'setup',
      minBrl: 80000,
      listBrl: 100000,
      maxBrl: 150000,
    });
    expect(r.success).toBe(true);
  });

  it('ACCEPTS equality boundary min === list === max', () => {
    const r = UpsertPriceBandSchema.safeParse({
      component: 'monthly',
      minBrl: 10000,
      listBrl: 10000,
      maxBrl: 10000,
    });
    expect(r.success).toBe(true);
  });

  it('ACCEPTS min === list < max', () => {
    const r = UpsertPriceBandSchema.safeParse({
      component: 'setup',
      minBrl: 100,
      listBrl: 100,
      maxBrl: 200,
    });
    expect(r.success).toBe(true);
  });

  it('ACCEPTS min < list === max', () => {
    const r = UpsertPriceBandSchema.safeParse({
      component: 'setup',
      minBrl: 100,
      listBrl: 200,
      maxBrl: 200,
    });
    expect(r.success).toBe(true);
  });

  it('REJECTS min > list', () => {
    const r = UpsertPriceBandSchema.safeParse({
      component: 'setup',
      minBrl: 100,
      listBrl: 50,
      maxBrl: 200,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('min <= list <= max required');
    }
  });

  it('REJECTS list > max', () => {
    const r = UpsertPriceBandSchema.safeParse({
      component: 'setup',
      minBrl: 0,
      listBrl: 200,
      maxBrl: 100,
    });
    expect(r.success).toBe(false);
  });

  it('REJECTS a negative value (nonnegative)', () => {
    const r = UpsertPriceBandSchema.safeParse({
      component: 'setup',
      minBrl: -1,
      listBrl: 100,
      maxBrl: 200,
    });
    expect(r.success).toBe(false);
  });
});

describe('UpsertCommissionRuleSchema — rate range 0..100 (Phase 02 T05)', () => {
  it('REJECTS setupRatePct > 100', () => {
    const r = UpsertCommissionRuleSchema.safeParse({
      setupRatePct: 101,
      recurringRatePct: 20,
      recurringMonths: 12,
    });
    expect(r.success).toBe(false);
  });

  it('REJECTS recurringRatePct < 0', () => {
    const r = UpsertCommissionRuleSchema.safeParse({
      setupRatePct: 30,
      recurringRatePct: -1,
      recurringMonths: 12,
    });
    expect(r.success).toBe(false);
  });

  it('ACCEPTS valid rates with default basis', () => {
    const r = UpsertCommissionRuleSchema.safeParse({
      setupRatePct: 30,
      recurringRatePct: 20,
      recurringMonths: 12,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.basis).toBe('quoted_net');
  });
});
