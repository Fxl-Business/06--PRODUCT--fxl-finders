import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { getAdminDb } from '../../../db/client.js';
import { apps, commissionRules, priceBands, products } from '../../../db/schema.js';

/**
 * Admin products / price-bands / commission-rules service (Phase 02, T05).
 *
 * products, price_bands, commission_rules are global admin-managed tables with
 * NO RLS. This service runs on getAdminDb() and NEVER calls
 * setTenantContext. Money flows as int cents; rates as numeric(5,2) (string in
 * Drizzle - cast with Number() on read, String() on write).
 */

type Db = ReturnType<typeof getAdminDb>;
type ProductRow = typeof products.$inferSelect;
type PriceBandRow = typeof priceBands.$inferSelect;
type CommissionRuleRow = typeof commissionRules.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  appId: z.string().uuid(),
  slug: z.string().min(1).max(64),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['active', 'archived']).default('active'),
});

// appId is immutable - omitted so it can never flow through an update.
export const UpdateProductSchema = CreateProductSchema.omit({ appId: true }).partial();

export const UpsertPriceBandSchema = z
  .object({
    component: z.enum(['setup', 'monthly']),
    minBrl: z.number().int().nonnegative(),
    listBrl: z.number().int().nonnegative(),
    maxBrl: z.number().int().nonnegative(),
  })
  .refine((data) => data.minBrl <= data.listBrl && data.listBrl <= data.maxBrl, {
    message: 'min <= list <= max required',
  });

export const UpsertCommissionRuleSchema = z.object({
  setupRatePct: z.number().min(0).max(100),
  recurringRatePct: z.number().min(0).max(100),
  recurringMonths: z.number().int().nonnegative(),
  basis: z.enum(['quoted_net', 'list_net']).default('quoted_net'),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type UpsertPriceBandInput = z.infer<typeof UpsertPriceBandSchema>;
export type UpsertCommissionRuleInput = z.infer<typeof UpsertCommissionRuleSchema>;

export const ComponentParamSchema = z.enum(['setup', 'monthly']);

// ─────────────────────────────────────────────────────────────────────────────
// Service functions
// ─────────────────────────────────────────────────────────────────────────────

export async function listProducts(
  db: Db,
  appId?: string,
): Promise<(ProductRow & { appName: string; appSlug: string })[]> {
  const rows = await db
    .select({
      product: products,
      appName: apps.name,
      appSlug: apps.slug,
    })
    .from(products)
    .innerJoin(apps, eq(products.appId, apps.id))
    .orderBy(products.name);
  return rows
    .filter((r) => (appId ? r.product.appId === appId : true))
    .map((r) => ({ ...r.product, appName: r.appName, appSlug: r.appSlug }));
}

export async function getProduct(
  db: Db,
  id: string,
): Promise<{
  product: ProductRow;
  priceBands: PriceBandRow[];
  commissionRule: CommissionRuleRow | undefined;
} | undefined> {
  const productRows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  const product = productRows[0];
  if (!product) return undefined;
  const bands = await db.select().from(priceBands).where(eq(priceBands.productId, id));
  const ruleRows = await db
    .select()
    .from(commissionRules)
    .where(eq(commissionRules.productId, id))
    .limit(1);
  return { product, priceBands: bands, commissionRule: ruleRows[0] };
}

export async function createProduct(db: Db, data: CreateProductInput): Promise<ProductRow> {
  const inserted = await db.insert(products).values(data).returning();
  return inserted[0]!; // INSERT ... RETURNING always yields one row
}

export async function updateProduct(
  db: Db,
  id: string,
  data: UpdateProductInput,
): Promise<ProductRow | undefined> {
  const [product] = await db
    .update(products)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
  return product;
}

export async function upsertPriceBand(
  db: Db,
  productId: string,
  data: UpsertPriceBandInput,
): Promise<PriceBandRow> {
  const [band] = await db
    .insert(priceBands)
    .values({
      productId,
      component: data.component,
      minBrl: data.minBrl,
      listBrl: data.listBrl,
      maxBrl: data.maxBrl,
    })
    .onConflictDoUpdate({
      target: [priceBands.productId, priceBands.component],
      set: {
        minBrl: data.minBrl,
        listBrl: data.listBrl,
        maxBrl: data.maxBrl,
        updatedAt: new Date(),
      },
    })
    .returning();
  return band!; // upsert RETURNING always yields one row
}

export async function listPriceBands(db: Db, productId: string): Promise<PriceBandRow[]> {
  return db.select().from(priceBands).where(eq(priceBands.productId, productId));
}

export async function upsertCommissionRule(
  db: Db,
  productId: string,
  data: UpsertCommissionRuleInput,
): Promise<CommissionRuleRow> {
  const [rule] = await db
    .insert(commissionRules)
    .values({
      productId,
      // numeric(5,2) columns are strings in Drizzle.
      setupRatePct: String(data.setupRatePct),
      recurringRatePct: String(data.recurringRatePct),
      recurringMonths: data.recurringMonths,
      basis: data.basis,
    })
    .onConflictDoUpdate({
      target: commissionRules.productId,
      set: {
        setupRatePct: String(data.setupRatePct),
        recurringRatePct: String(data.recurringRatePct),
        recurringMonths: data.recurringMonths,
        basis: data.basis,
        updatedAt: new Date(),
      },
    })
    .returning();
  return rule!; // upsert RETURNING always yields one row
}

export async function getCommissionRule(
  db: Db,
  productId: string,
): Promise<CommissionRuleRow | undefined> {
  const rows = await db
    .select()
    .from(commissionRules)
    .where(eq(commissionRules.productId, productId))
    .limit(1);
  return rows[0];
}
