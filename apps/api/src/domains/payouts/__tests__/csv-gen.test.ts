/**
 * Phase 06 T04 — payout CSV byte-contract (D4).
 *
 * Tests the PURE buildCsvBuffer (separated from the DB fetch) so the byte contract
 * is asserted without a live DB. UTF-8 BOM + the PINNED header row + pt-BR money.
 */
import { describe, expect, it } from 'vitest';
import { buildCsvBuffer, type CsvPayoutLine } from '../service.js';

const PINNED_HEADER = 'finder_name,cpf,pix_key,pix_key_type,amount_brl,commission_ids';

function line(overrides: Partial<CsvPayoutLine> = {}): CsvPayoutLine {
  return {
    finderName: 'Maria Silva',
    cpf: '12345678901',
    pixKey: 'maria@example.com',
    pixKeyType: 'email',
    totalBrl: 123456,
    commissionIds: ['11111111-1111-1111-1111-111111111111'],
    ...overrides,
  };
}

describe('buildCsvBuffer (payout CSV byte contract, D4)', () => {
  it('starts with the UTF-8 BOM bytes [0xEF, 0xBB, 0xBF]', () => {
    const buf = buildCsvBuffer([line()]);
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
  });

  it('first text line is byte-exactly the pinned header row', () => {
    const buf = buildCsvBuffer([line()]);
    const text = buf.toString('utf-8').slice(1); // strip BOM char
    const firstLine = text.split('\n')[0];
    expect(firstLine).toBe(PINNED_HEADER);
  });

  it('formats a 123456-cent amount as 1.234,56 (pt-BR)', () => {
    const buf = buildCsvBuffer([line({ totalBrl: 123456 })]);
    const text = buf.toString('utf-8').slice(1);
    const dataLine = text.split('\n')[1];
    expect(dataLine).toContain('1.234,56');
  });

  it('formats a 1000-cent amount as 10,00 (pt-BR)', () => {
    const buf = buildCsvBuffer([line({ totalBrl: 1000, commissionIds: ['a'] })]);
    const text = buf.toString('utf-8').slice(1);
    const dataLine = text.split('\n')[1];
    expect(dataLine).toContain('10,00');
  });

  it('joins + double-quotes commission_ids in the cell', () => {
    const ids = [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
    ];
    const buf = buildCsvBuffer([line({ commissionIds: ids })]);
    const text = buf.toString('utf-8').slice(1);
    const dataLine = text.split('\n')[1];
    expect(dataLine).toContain(`"${ids.join(',')}"`);
  });

  it('empty input → BOM + header row only (no data rows)', () => {
    const buf = buildCsvBuffer([]);
    const text = buf.toString('utf-8').slice(1);
    const dataLines = text.split('\n').filter((l) => l.length > 0);
    expect(dataLines).toHaveLength(1);
    expect(dataLines[0]).toBe(PINNED_HEADER);
  });

  it('non-ASCII finder name is preserved (UTF-8)', () => {
    const buf = buildCsvBuffer([line({ finderName: 'José Antônio Açaí' })]);
    const text = buf.toString('utf-8').slice(1);
    expect(text).toContain('José Antônio Açaí');
  });
});
