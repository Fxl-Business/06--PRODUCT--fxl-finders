import { cors } from 'hono/cors';
import { env } from '../env.js';

export const corsMiddleware = cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
});
