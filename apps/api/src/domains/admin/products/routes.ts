import { Hono } from 'hono';
import { getAdminDb } from '../../../db/client.js';
import {
  ComponentParamSchema,
  CreateProductSchema,
  UpdateProductSchema,
  UpsertCommissionRuleSchema,
  UpsertPriceBandSchema,
  createProduct,
  getCommissionRule,
  getProduct,
  listPriceBands,
  listProducts,
  updateProduct,
  upsertCommissionRule,
  upsertPriceBand,
} from './service.js';

/**
 * Admin products routes (Phase 02, T05). Inherits clerkAuthMiddleware +
 * requireAdmin from the parent adminRouter. Uses getAdminDb() (BYPASSRLS) —
 * admin tables have NO RLS. NEVER setTenantContext.
 */
export const adminProductsRouter = new Hono();

adminProductsRouter.get('/', async (c) => {
  const db = getAdminDb();
  const appId = c.req.query('appId');
  const rows = await listProducts(db, appId);
  return c.json({ products: rows });
});

adminProductsRouter.get('/:id', async (c) => {
  const db = getAdminDb();
  const result = await getProduct(db, c.req.param('id'));
  if (!result) return c.json({ error: 'not_found' }, 404);
  return c.json(result);
});

adminProductsRouter.post('/', async (c) => {
  const parsed = CreateProductSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: 'validation_error', issues: parsed.error.flatten() }, 400);
  }
  const db = getAdminDb();
  const product = await createProduct(db, parsed.data);
  return c.json({ product }, 201);
});

adminProductsRouter.patch('/:id', async (c) => {
  const parsed = UpdateProductSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: 'validation_error', issues: parsed.error.flatten() }, 400);
  }
  const db = getAdminDb();
  const product = await updateProduct(db, c.req.param('id'), parsed.data);
  if (!product) return c.json({ error: 'not_found' }, 404);
  return c.json({ product });
});

adminProductsRouter.put('/:id/price-bands/:component', async (c) => {
  const componentParsed = ComponentParamSchema.safeParse(c.req.param('component'));
  if (!componentParsed.success) {
    return c.json({ error: 'validation_error', reason: 'invalid_component' }, 400);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpsertPriceBandSchema.safeParse({ ...body, component: componentParsed.data });
  if (!parsed.success) {
    return c.json({ error: 'validation_error', issues: parsed.error.flatten() }, 400);
  }
  const db = getAdminDb();
  const priceBand = await upsertPriceBand(db, c.req.param('id'), parsed.data);
  return c.json({ priceBand });
});

adminProductsRouter.get('/:id/price-bands', async (c) => {
  const db = getAdminDb();
  const priceBands = await listPriceBands(db, c.req.param('id'));
  return c.json({ priceBands });
});

adminProductsRouter.put('/:id/commission-rule', async (c) => {
  const parsed = UpsertCommissionRuleSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: 'validation_error', issues: parsed.error.flatten() }, 400);
  }
  const db = getAdminDb();
  const commissionRule = await upsertCommissionRule(db, c.req.param('id'), parsed.data);
  return c.json({ commissionRule });
});

adminProductsRouter.get('/:id/commission-rule', async (c) => {
  const db = getAdminDb();
  const commissionRule = await getCommissionRule(db, c.req.param('id'));
  if (!commissionRule) return c.json({ error: 'not_found' }, 404);
  return c.json({ commissionRule });
});
