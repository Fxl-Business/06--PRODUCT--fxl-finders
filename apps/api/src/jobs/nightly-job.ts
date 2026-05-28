import cron, { type ScheduledTask } from 'node-cron';
import { getAdminDb } from '../db/client.js';
import { promoteHoldExpired } from '../domains/commissions/service.js';

/**
 * Nightly hold promotion (Phase 05 T09, D-K/D-C/D1).
 *
 * Promotes commissions pending→locked WHERE hold_until < now() (D-K: no `approved`
 * step). A freshly-ingested commission (status='pending') reaches 'locked' here with
 * NO manual action — this is the auto path. Runs on getAdminDb() (BYPASSRLS) because
 * it is cross-tenant with no JWT (D-C).
 *
 * Schedule: 03:00 UTC daily via node-cron (single scheduler instance in apps/api —
 * Phase 06 must register any payout job on THIS scheduler, not a second one).
 * Manual trigger: POST /api/v1/admin/commissions/promote-locked (requireAdmin).
 * v1.1 upgrade path: extract to a BullMQ worker for distributed deploys.
 */

let task: ScheduledTask | null = null;

export function setupNightlyJob(): void {
  if (task) return; // single instance guard
  task = cron.schedule('0 3 * * *', async () => {
    try {
      const promoted = await promoteHoldExpired(getAdminDb());
      console.log(`[nightly-job] hold promotion: ${promoted} commissions promoted pending→locked`);
    } catch (err) {
      // Never crash the process — log and let the next run retry.
      console.error('[nightly-job] hold promotion failed:', err);
    }
  });
}

/** Extracted for testability + the manual admin trigger endpoint. */
export async function runHoldPromotion(): Promise<{ promoted: number }> {
  const promoted = await promoteHoldExpired(getAdminDb());
  return { promoted };
}

/** Graceful shutdown — stop the scheduled task (plan-brief Wave 4 failure-list). */
export function stopNightlyJob(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
