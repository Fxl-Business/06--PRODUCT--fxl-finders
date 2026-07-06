import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';

import { getAdminDb } from '../../../db/client.js';
import { auditLog, finders } from '../../../db/schema.js';
import { approveFinder, suspendFinder } from '../admin-service.js';

const ADMIN_USER = 'hub-admin-test';
const TEST_PREFIX = 'sm-test-';
const seededIds: string[] = [];

function must<T>(v: T | undefined): T {
  if (v === undefined) throw new Error('expected a row, got undefined');
  return v;
}

async function seedFinder(status: 'pending' | 'approved' | 'suspended'): Promise<string> {
  const db = getAdminDb();
  const unique = `${TEST_PREFIX}${crypto.randomUUID()}`;
  const workspaceId = status === 'pending' ? null : `org_${unique}`;
  const [row] = await db
    .insert(finders)
    .values({
      orgId: status === 'pending' ? '' : workspaceId!,
      accountId: null,
      workspaceId,
      status,
      displayName: `Finder ${unique}`,
      contactEmail: `${unique}@example.com`,
      lgpdConsentEssential: true,
      lgpdConsentMarketing: false,
      lgpdConsentVersion: 'v1.0',
      lgpdConsentedAt: new Date(),
    })
    .returning({ id: finders.id });
  const id = must(row).id;
  seededIds.push(id);
  return id;
}

afterEach(async () => {
  const db = getAdminDb();
  if (seededIds.length) {
    await db.delete(auditLog).where(inArray(auditLog.entityId, seededIds));
    await db.delete(finders).where(inArray(finders.id, seededIds));
    seededIds.length = 0;
  }
});

afterAll(async () => {
  const { closeDb } = await import('../../../db/client.js');
  await closeDb();
});

describe('approveFinder', () => {
  it('pending -> approved happy path: flips status, persists workspace id, audits', async () => {
    const id = await seedFinder('pending');
    const res = await approveFinder(id, ADMIN_USER);
    expect(res).toEqual({ id, status: 'approved' });

    const db = getAdminDb();
    const [rawRow] = await db.select().from(finders).where(eq(finders.id, id)).limit(1);
    const row = must(rawRow);
    expect(row.status).toBe('approved');
    expect(row.workspaceId).toBe(id);
    expect(row.orgId).toBe(id);
    expect(row.approvedByUserId).toBe(ADMIN_USER);
    expect(row.approvedAt).toBeInstanceOf(Date);

    const audits = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, id), eq(auditLog.action, 'finder.approved')));
    expect(audits.length).toBe(1);
    expect(audits[0]?.afterJsonb).toEqual({ workspaceId: id, provisioning: 'operator_owned' });
  });

  it('rejects approve when status is not pending', async () => {
    const id = await seedFinder('suspended');
    await expect(approveFinder(id, ADMIN_USER)).rejects.toMatchObject({
      code: 'invalid_state',
    });
  });

  it('double-approve is idempotent', async () => {
    const id = await seedFinder('pending');
    await approveFinder(id, ADMIN_USER);
    const second = await approveFinder(id, ADMIN_USER);
    expect(second).toEqual({ id, status: 'approved' });

    const db = getAdminDb();
    const audits = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, id), eq(auditLog.action, 'finder.approved')));
    expect(audits.length).toBe(1);
  });
});

describe('suspendFinder', () => {
  it('suspending a pending finder throws invalid_state', async () => {
    const id = await seedFinder('pending');
    await expect(suspendFinder(id, ADMIN_USER, 'fraude')).rejects.toMatchObject({
      code: 'invalid_state',
    });
  });

  it('suspending an approved finder sets status + reason + audits', async () => {
    const id = await seedFinder('approved');
    const res = await suspendFinder(id, ADMIN_USER, 'violação de termos');
    expect(res).toEqual({ id, status: 'suspended' });

    const db = getAdminDb();
    const [rawRow] = await db.select().from(finders).where(eq(finders.id, id)).limit(1);
    const row = must(rawRow);
    expect(row.status).toBe('suspended');
    expect(row.suspendedReason).toBe('violação de termos');
    expect(row.suspendedAt).toBeInstanceOf(Date);

    const audits = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, id), eq(auditLog.action, 'finder.suspended')));
    expect(audits.length).toBe(1);
  });

  it('suspending an already-suspended finder is an idempotent no-op', async () => {
    const id = await seedFinder('suspended');
    const res = await suspendFinder(id, ADMIN_USER, 'again');
    expect(res).toEqual({ id, status: 'suspended' });
  });
});
