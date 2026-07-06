import { desc, eq } from 'drizzle-orm';
import { getAdminDb } from '../../db/client.js';
import { sellers } from '../../db/schema.js';

/**
 * Admin sellers service (Phase 03 T04).
 *
 * `sellers` is admin-managed cross-tenant (no RLS). Uses getAdminDb() (D-H/D-C)
 * for consistency with the other admin routes; setTenantContext is NEVER called.
 * Hub account provisioning is operator-owned, so account_id remains nullable.
 */

export type SellerRow = typeof sellers.$inferSelect;
export type SellerStatus = 'active' | 'inactive';

export async function listSellers(): Promise<SellerRow[]> {
  const db = getAdminDb();
  return db.select().from(sellers).orderBy(desc(sellers.createdAt));
}

export async function createSellerAndInvite(
  input: { displayName: string; contactEmail: string },
  _adminUserId: string,
): Promise<SellerRow> {
  const db = getAdminDb();

  const [seller] = await db
    .insert(sellers)
    .values({
      accountId: null,
      displayName: input.displayName,
      contactEmail: input.contactEmail,
      status: 'active',
    })
    .returning();

  if (!seller) throw new Error('seller_insert_failed');

  return seller;
}

export async function setSellerStatus(
  sellerId: string,
  status: SellerStatus,
): Promise<SellerRow | null> {
  const db = getAdminDb();
  const [seller] = await db
    .update(sellers)
    .set({ status, updatedAt: new Date() })
    .where(eq(sellers.id, sellerId))
    .returning();
  return seller ?? null;
}
