import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { env } from './env.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorMiddleware } from './middleware/error.js';
import { healthRouter } from './routes/health.js';

const app = new Hono();

app.use('*', logger());
app.use('*', corsMiddleware);
app.use('*', errorMiddleware);

app.route('/health', healthRouter);

app.get('/', (c) =>
  c.json({
    name: 'Fxl Finders API',
    docs: '/health for liveness, add domain routes under apps/api/src/domains/',
  }),
);

app.notFound((c) => c.json({ error: 'not_found', path: c.req.path }, 404));

const port = env.PORT;
console.log(`[fxl-finders-api] listening on http://localhost:${port} (${env.NODE_ENV})`);

serve({ fetch: app.fetch, port });
