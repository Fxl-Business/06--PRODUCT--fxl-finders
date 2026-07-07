import { describe, expect, it } from 'vitest';
import {
  CreateSaleSchema,
  buildSaleLedger,
  summarizeSalesOpsState,
} from '../service.js';

describe('sales operations sale ledger', () => {
  it('creates receivables and payables from a complete sale payload', () => {
    const parsed = CreateSaleSchema.parse({
      clientId: '11111111-1111-4111-8111-111111111111',
      clientName: 'Dias Pet',
      sellerPersonId: '22222222-2222-4222-8222-222222222222',
      sellerName: 'Ana Martins',
      finderPersonId: '33333333-3333-4333-8333-333333333333',
      finderName: 'Carlinhos',
      status: 'closed',
      paymentMethod: 'pix',
      condition: 'installments',
      installments: 3,
      baseDate: '2026-07-10',
      notes: 'Setup com onboarding assistido.',
      sellerCommissionPct: 10,
      finderCommissionPct: 3,
      taxPct: 6,
      otherCostsBrl: 60000,
      items: [
        {
          productId: '44444444-4444-4444-8444-444444444444',
          productName: 'FXL Finance',
          productType: 'SaaS',
          quantity: 1,
          unitBrl: 800000,
        },
      ],
      professionals: [
        {
          personId: '55555555-5555-4555-8555-555555555555',
          personName: 'Rafael Nunes',
          role: 'Desenvolvimento',
          costBrl: 240000,
        },
        {
          personId: '66666666-6666-4666-8666-666666666666',
          personName: 'Julia Prado',
          role: 'Design',
          costBrl: 180000,
        },
      ],
    });

    const ledger = buildSaleLedger(parsed);

    expect(ledger.sale.totalBrl).toBe(800000);
    expect(ledger.sale.netMarginBrl).toBe(168000);
    expect(ledger.sale.netMarginPct).toBe('21.00');
    expect(ledger.receivables).toEqual([
      expect.objectContaining({ label: '1/3', amountBrl: 266666, dueDate: '2026-07-10' }),
      expect.objectContaining({ label: '2/3', amountBrl: 266666, dueDate: '2026-08-10' }),
      expect.objectContaining({ label: '3/3', amountBrl: 266668, dueDate: '2026-09-10' }),
    ]);
    expect(ledger.payables.map((payable) => [payable.kind, payable.amountBrl])).toEqual([
      ['seller_commission', 80000],
      ['finder_commission', 24000],
      ['professional_cost', 240000],
      ['professional_cost', 180000],
      ['tax', 48000],
      ['other_cost', 60000],
    ]);
  });

  it('summarizes empty persisted state without prototype seed rows', () => {
    const summary = summarizeSalesOpsState({
      sales: [],
      products: [],
      clients: [],
      people: [],
      payables: [],
    });

    expect(summary.kpis.closedRevenueBrl).toBe(0);
    expect(summary.kpis.activeMrrBrl).toBe(0);
    expect(summary.kpis.payableBrl).toBe(0);
    expect(summary.latestSales).toEqual([]);
    expect(summary.revenueByProduct).toEqual([]);
  });
});
