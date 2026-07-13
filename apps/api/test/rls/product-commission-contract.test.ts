import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../../src/db/schema.js';
import {
  ProductSchema,
  createProduct,
  listProducts,
  updateProduct,
} from '../../src/domains/sales-ops/service.js';

const APP_DB_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5006/fxl_sales';
const ADMIN_DB_URL = process.env.ADMIN_DATABASE_URL ?? APP_DB_URL;
const ADMIN_CONNECTION_OPTIONS = { connection: { 'app.fxl_admin': 'true' } } as const;

describe('sales operations product commission persistence', () => {
  let appClient: postgres.Sql;
  let adminClient: postgres.Sql;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const orgIds: string[] = [];

  beforeAll(() => {
    appClient = postgres(APP_DB_URL, { max: 2 });
    adminClient = postgres(ADMIN_DB_URL, { max: 1, ...ADMIN_CONNECTION_OPTIONS });
    db = drizzle(appClient, { schema });
  });

  afterAll(async () => {
    for (const orgId of orgIds) {
      await adminClient`DELETE FROM sales_ops_products WHERE org_id = ${orgId}`;
    }
    await appClient.end();
    await adminClient.end();
  });

  it('persists independent commission pairs through create, partial updates, and list', async () => {
    const orgId = `org_product_commission_${Date.now()}`;
    orgIds.push(orgId);
    const created = await createProduct(
      db,
      orgId,
      ProductSchema.parse({
        name: 'Independent commissions',
        codeSuffix: '91',
        sellerCommissionType: 'pct',
        sellerCommissionValue: 10,
        sellerWithFinderCommissionType: 'pct',
        sellerWithFinderCommissionValue: 7,
        finderCommissionType: 'pct',
        finderCommissionValue: 3,
      }),
    );

    expect(created.sellerCommissionValue).toBe('10.00');
    expect(created.sellerWithFinderCommissionValue).toBe('7.00');
    expect(created.finderCommissionValue).toBe('3.00');

    const sellerOnlyUpdate = await updateProduct(db, orgId, created.id, {
      sellerCommissionValue: 11,
    });
    expect(sellerOnlyUpdate?.sellerCommissionValue).toBe('11.00');
    expect(sellerOnlyUpdate?.sellerWithFinderCommissionValue).toBe('7.00');

    const splitUpdate = await updateProduct(db, orgId, created.id, {
      sellerWithFinderCommissionValue: 8,
    });
    expect(splitUpdate?.sellerCommissionValue).toBe('11.00');
    expect(splitUpdate?.sellerWithFinderCommissionValue).toBe('8.00');
    expect(splitUpdate?.finderCommissionValue).toBe('3.00');

    const listed = await listProducts(db, orgId);
    expect(listed).toEqual([
      expect.objectContaining({
        sellerCommissionValue: '11.00',
        sellerWithFinderCommissionType: 'pct',
        sellerWithFinderCommissionValue: '8.00',
        finderCommissionValue: '3.00',
      }),
    ]);
  });

  it('copies the seller-only pair when a legacy create payload omits the new pair', async () => {
    const orgId = `org_product_commission_legacy_${Date.now()}`;
    orgIds.push(orgId);
    const created = await createProduct(
      db,
      orgId,
      ProductSchema.parse({
        name: 'Legacy fixed commission',
        codeSuffix: '92',
        sellerCommissionType: 'fix',
        sellerCommissionValue: 1234.56,
        finderCommissionType: 'fix',
        finderCommissionValue: 321,
      }),
    );

    expect(created.sellerWithFinderCommissionType).toBe('fix');
    expect(created.sellerWithFinderCommissionValue).toBe('1234.56');
  });
});
