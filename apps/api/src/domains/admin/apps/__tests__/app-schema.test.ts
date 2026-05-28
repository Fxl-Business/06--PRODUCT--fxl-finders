import { describe, expect, it } from 'vitest';
import { CreateAppSchema, UpdateAppSchema } from '../service.js';

describe('CreateAppSchema — bare-hostname validation (Phase 02 T04, WARN/LOCKED)', () => {
  const base = {
    slug: 'fxl-financiero',
    name: 'FXL Financiero',
    attributionWindowDays: 30,
    commissionHoldDays: 30,
  };

  it('ACCEPTS a bare hostname', () => {
    const r = CreateAppSchema.safeParse({
      ...base,
      allowedRedirectHosts: ['checkout.fxlfinanciero.com.br'],
    });
    expect(r.success).toBe(true);
  });

  it('REJECTS a value with a scheme (https://)', () => {
    const r = CreateAppSchema.safeParse({
      ...base,
      allowedRedirectHosts: ['https://checkout.fxlfinanciero.com.br'],
    });
    expect(r.success).toBe(false);
  });

  it('REJECTS a value with a path', () => {
    const r = CreateAppSchema.safeParse({ ...base, allowedRedirectHosts: ['host.com/path'] });
    expect(r.success).toBe(false);
  });

  it('REJECTS a value with a port', () => {
    const r = CreateAppSchema.safeParse({ ...base, allowedRedirectHosts: ['host.com:443'] });
    expect(r.success).toBe(false);
  });

  it('REJECTS an empty hosts array (.min(1))', () => {
    const r = CreateAppSchema.safeParse({ ...base, allowedRedirectHosts: [] });
    expect(r.success).toBe(false);
  });
});

describe('UpdateAppSchema — slug immutability (Phase 02 T04, D-R NIT)', () => {
  it('STRIPS slug — an update can never carry a slug key', () => {
    const result = UpdateAppSchema.parse({ slug: 'changed', name: 'New name' });
    expect('slug' in result).toBe(false);
    expect(result.name).toBe('New name');
  });

  it('is exactly CreateAppSchema.omit({ slug }).partial() — name optional', () => {
    const result = UpdateAppSchema.parse({});
    expect(result).toEqual({});
  });
});
