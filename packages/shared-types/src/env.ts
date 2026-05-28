import { z } from 'zod';

/**
 * Shared env schema fragments. Each app composes these with its own
 * app-specific schema in `src/env.ts` (api/web/site/mobile).
 */

export const sharedServerEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SENTRY_DSN: z.string().url().optional(),
});

export const sharedClientEnv = z.object({
  VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  VITE_SENTRY_DSN: z.string().url().optional(),
});

export type SharedServerEnv = z.infer<typeof sharedServerEnv>;
export type SharedClientEnv = z.infer<typeof sharedClientEnv>;
