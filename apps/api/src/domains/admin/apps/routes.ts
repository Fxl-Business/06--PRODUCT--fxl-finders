import { Hono } from 'hono';
import { getAdminDb } from '../../../db/client.js';
import {
  AppStatusSchema,
  CreateAppSchema,
  UpdateAppSchema,
  createApp,
  getApp,
  listApps,
  rotateSecretKey,
  rotateWebhookSigningSecret,
  setAppStatus,
  updateApp,
} from './service.js';

/**
 * Admin apps routes (Phase 02, T04). All routes inherit appAuthMiddleware +
 * requireAdmin from the parent adminRouter mount - do NOT re-apply auth here.
 *
 * Uses getAdminDb() - admin tables have NO RLS. NEVER setTenantContext.
 */
export const adminAppsRouter = new Hono();

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

adminAppsRouter.get('/', async (c) => {
  const db = getAdminDb();
  const rows = await listApps(db);
  return c.json({ apps: rows });
});

adminAppsRouter.get('/:id', async (c) => {
  const db = getAdminDb();
  const app = await getApp(db, c.req.param('id'));
  if (!app) return c.json({ error: 'not_found' }, 404);
  return c.json({ app });
});

adminAppsRouter.post('/', async (c) => {
  const parsed = CreateAppSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: 'validation_error', issues: parsed.error.flatten() }, 400);
  }
  const db = getAdminDb();
  try {
    const result = await createApp(db, parsed.data, c.get('userId'));
    return c.json(result, 201);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return c.json({ error: 'conflict', reason: 'slug_already_exists' }, 409);
    }
    throw err;
  }
});

adminAppsRouter.patch('/:id', async (c) => {
  const parsed = UpdateAppSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: 'validation_error', issues: parsed.error.flatten() }, 400);
  }
  const db = getAdminDb();
  const app = await updateApp(db, c.req.param('id'), parsed.data, c.get('userId'));
  if (!app) return c.json({ error: 'not_found' }, 404);
  return c.json({ app });
});

adminAppsRouter.post('/:id/rotate-secret-key', async (c) => {
  const db = getAdminDb();
  const result = await rotateSecretKey(db, c.req.param('id'), c.get('userId'));
  if (!result) return c.json({ error: 'not_found' }, 404);
  return c.json(result);
});

adminAppsRouter.post('/:id/rotate-webhook-secret', async (c) => {
  const db = getAdminDb();
  const result = await rotateWebhookSigningSecret(db, c.req.param('id'), c.get('userId'));
  if (!result) return c.json({ error: 'not_found' }, 404);
  return c.json(result);
});

adminAppsRouter.patch('/:id/status', async (c) => {
  const parsed = AppStatusSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: 'validation_error', issues: parsed.error.flatten() }, 400);
  }
  const db = getAdminDb();
  const app = await setAppStatus(db, c.req.param('id'), parsed.data.status, c.get('userId'));
  if (!app) return c.json({ error: 'not_found' }, 404);
  return c.json({ app });
});
