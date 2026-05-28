import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

export const errorMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (err) {
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    console.error('[error-middleware]', err);
    return c.json(
      {
        error: 'internal_server_error',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500,
    );
  }
};
