import { Hono } from 'hono';
import { handleReferralClick } from './click-handler.js';

export const referralsRouter = new Hono();

referralsRouter.get('/:code', async (c) => handleReferralClick(c.req.param('code'), c.req.raw));
