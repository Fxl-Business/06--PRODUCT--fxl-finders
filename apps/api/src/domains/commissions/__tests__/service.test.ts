/**
 * Commission service unit tests (Phase 05 T03 — TDD, RED first).
 *
 * Pure-function coverage: commission calc (setup + recurring, incl. STRING rate
 * from Drizzle numeric — plan-brief Wave 4 failure-list), state-machine
 * transitions (D-K: pending→locked→paid→reversed, no auto `approved`), and
 * buildCommissionRows (D4: skip zero-amount rows).
 */
import { describe, expect, it } from 'vitest';
import {
  buildCommissionRows,
  calculateRecurringCommission,
  calculateSetupCommission,
  isValidTransition,
  type CommissionStatus,
} from '../service.js';

describe('calculateSetupCommission', () => {
  it('100000 cents @ 30.00% = 30000', () => {
    expect(calculateSetupCommission(100000, 30.0)).toBe(30000);
  });

  it('100000 cents @ STRING "30.00" = 30000 (Drizzle numeric returns string)', () => {
    expect(calculateSetupCommission(100000, '30.00')).toBe(30000);
  });

  it('80000 cents @ 25.50% = 20400', () => {
    expect(calculateSetupCommission(80000, 25.5)).toBe(20400);
  });

  it('80000 cents @ STRING "25.50" = 20400', () => {
    expect(calculateSetupCommission(80000, '25.50')).toBe(20400);
  });

  it('zero realized → zero commission', () => {
    expect(calculateSetupCommission(0, 30.0)).toBe(0);
  });

  it('floors to int cents: 100001 @ 30% = 30000', () => {
    expect(calculateSetupCommission(100001, 30.0)).toBe(30000);
  });

  it('returns an integer', () => {
    expect(Number.isInteger(calculateSetupCommission(100001, 30.0))).toBe(true);
  });
});

describe('calculateRecurringCommission', () => {
  it('10700 cents @ 20.00% * 12 = 25680', () => {
    expect(calculateRecurringCommission(10700, 20.0, 12)).toBe(25680);
  });

  it('10700 cents @ STRING "20.00" * 12 = 25680', () => {
    expect(calculateRecurringCommission(10700, '20.00', 12)).toBe(25680);
  });

  it('recurring_months = 0 → 0 (no recurring commission)', () => {
    expect(calculateRecurringCommission(10700, 20.0, 0)).toBe(0);
  });

  it('zero realized → 0', () => {
    expect(calculateRecurringCommission(0, 20.0, 12)).toBe(0);
  });

  it('returns an integer', () => {
    expect(Number.isInteger(calculateRecurringCommission(10700, 20.0, 12))).toBe(true);
  });
});

describe('isValidTransition (D-K: auto path pending→locked→paid→reversed)', () => {
  const cases: Array<[CommissionStatus, CommissionStatus, boolean]> = [
    ['pending', 'locked', true], // auto AND manual fast-track
    ['locked', 'paid', true],
    ['paid', 'reversed', true],
    ['pending', 'reversed', true],
    ['locked', 'reversed', true],
    ['pending', 'paid', false], // must lock first
    ['locked', 'pending', false], // backwards
    ['paid', 'locked', false], // backwards
    ['reversed', 'pending', false], // terminal
    ['reversed', 'locked', false], // terminal
  ];
  it.each(cases)('%s → %s = %s', (from, to, expected) => {
    expect(isValidTransition(from, to)).toBe(expected);
  });

  it('never produces a *→approved transition in v1.0 (no auto approve)', () => {
    expect(isValidTransition('pending', 'approved')).toBe(false);
  });
});

describe('buildCommissionRows (D4: skip zero-amount rows)', () => {
  const holdUntil = new Date('2026-07-01T00:00:00Z');
  const baseConversion = {
    id: 'conv-1',
    orgId: 'org-1',
    finderId: 'finder-1',
    appId: 'app-1',
    productId: 'product-1',
    realizedSetupBrl: 100000,
    realizedMonthlyBrl: 10700,
  };
  const rule = {
    setupRatePct: '30.00',
    recurringRatePct: '20.00',
    recurringMonths: 12,
  };

  it('includes setup row when realized_setup_brl > 0', () => {
    const rows = buildCommissionRows(baseConversion, rule, holdUntil);
    const setup = rows.find((r) => r.kind === 'setup');
    expect(setup).toBeDefined();
    expect(setup?.basisBrl).toBe(100000);
    expect(setup?.ratePct).toBe('30.00');
    expect(setup?.amountBrl).toBe(30000);
  });

  it('does NOT include setup row when realized_setup_brl === 0', () => {
    const rows = buildCommissionRows({ ...baseConversion, realizedSetupBrl: 0 }, rule, holdUntil);
    expect(rows.find((r) => r.kind === 'setup')).toBeUndefined();
  });

  it('includes recurring row when recurring_months > 0 and realized_monthly_brl > 0', () => {
    const rows = buildCommissionRows(baseConversion, rule, holdUntil);
    const rec = rows.find((r) => r.kind === 'recurring');
    expect(rec).toBeDefined();
    expect(rec?.amountBrl).toBe(25680);
  });

  it('does NOT include recurring row when recurring_months === 0', () => {
    const rows = buildCommissionRows(baseConversion, { ...rule, recurringMonths: 0 }, holdUntil);
    expect(rows.find((r) => r.kind === 'recurring')).toBeUndefined();
  });

  it('does NOT include recurring row when realized_monthly_brl === 0', () => {
    const rows = buildCommissionRows(
      { ...baseConversion, realizedMonthlyBrl: 0 },
      rule,
      holdUntil,
    );
    expect(rows.find((r) => r.kind === 'recurring')).toBeUndefined();
  });

  it('returns an empty array for a fully zero-realized conversion (never undefined)', () => {
    const rows = buildCommissionRows(
      { ...baseConversion, realizedSetupBrl: 0, realizedMonthlyBrl: 0 },
      rule,
      holdUntil,
    );
    expect(rows).toEqual([]);
  });

  it('new rows start at status=pending with the given hold_until', () => {
    const rows = buildCommissionRows(baseConversion, rule, holdUntil);
    for (const row of rows) {
      expect(row.status).toBe('pending');
      expect(row.holdUntil).toBe(holdUntil);
      expect(row.orgId).toBe('org-1');
    }
  });
});
