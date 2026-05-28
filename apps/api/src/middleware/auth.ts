import type { MiddlewareHandler } from 'hono';
import { env } from '../env.js';

/**
 * Clerk JWT validation middleware.
 *
 * Reads Bearer token from Authorization header, verifies via @clerk/backend,
 * and exposes userId + orgId on Hono context:
 *
 *   const userId = c.get('userId');
 *   const orgId = c.get('orgId');
 *
 * In template state (CLERK_SECRET_KEY unset), middleware is a passthrough
 * and sets fake dev values. DO NOT ship to production without the key.
 */

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    orgId: string;
  }
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  if (!env.CLERK_SECRET_KEY) {
    // template / dev mode — pass through with placeholder values
    c.set('userId', 'dev_user');
    c.set('orgId', 'dev_org');
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized', reason: 'missing bearer token' }, 401);
  }

  // Real implementation:
  // const { verifyToken } = await import('@clerk/backend');
  // const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
  // c.set('userId', payload.sub);
  // c.set('orgId', payload.org_id ?? payload.sub);
  return c.json({ error: 'not_implemented', reason: 'wire up @clerk/backend in middleware/auth.ts' }, 501);
};
