import type { HubSessionRecord } from '@fxl-business/hub-sdk';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { hubSessions } from '../db/schema.js';
import { createHubSessionCipher } from './hub-session-crypto.js';
import type { HubSessionPersistence, PersistedHubSession } from './hub-session-store.js';

export function createDrizzleHubSessionPersistence(
  encryptionKey?: string,
): HubSessionPersistence {
  const cipher = createHubSessionCipher(encryptionKey);

  return {
    async loadAll(): Promise<PersistedHubSession[]> {
      const rows = await getDb()
        .select({
          id: hubSessions.id,
          encryptedRefreshToken: hubSessions.encryptedRefreshToken,
          accountId: hubSessions.accountId,
        })
        .from(hubSessions);
      const sessions: PersistedHubSession[] = [];

      for (const row of rows) {
        try {
          sessions.push({
            id: row.id,
            hubRefreshToken: cipher.decrypt(row.encryptedRefreshToken, row.id),
            ...(row.accountId === null ? {} : { accountId: row.accountId }),
          });
        } catch {
          console.warn('Skipping corrupt persisted Hub session');
        }
      }

      return sessions;
    },

    async put(sessionId: string, record: HubSessionRecord): Promise<void> {
      const encryptedRefreshToken = cipher.encrypt(record.hubRefreshToken, sessionId);
      const accountId = record.accountId ?? null;
      const now = new Date();

      await getDb()
        .insert(hubSessions)
        .values({
          id: sessionId,
          encryptedRefreshToken,
          accountId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: hubSessions.id,
          set: { encryptedRefreshToken, accountId, updatedAt: now },
        });
    },

    async remove(sessionId: string): Promise<void> {
      await getDb().delete(hubSessions).where(eq(hubSessions.id, sessionId));
    },
  };
}
