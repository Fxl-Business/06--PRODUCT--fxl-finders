import type { HubSessionRecord } from '@fxl-business/hub-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let selectedRows: Array<{
  id: string;
  encryptedRefreshToken: string;
  accountId: string | null;
}> = [];
const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
const insertValues = vi.fn((_values: Record<string, unknown>) => ({ onConflictDoUpdate }));
const insert = vi.fn(() => ({ values: insertValues }));
const selectFrom = vi.fn(async () => selectedRows);
const select = vi.fn(() => ({ from: selectFrom }));
const deleteWhere = vi.fn().mockResolvedValue(undefined);
const deleteFrom = vi.fn(() => ({ where: deleteWhere }));

vi.mock('../../db/client.js', () => ({
  getDb: () => ({
    delete: deleteFrom,
    insert,
    select,
  }),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const original = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...original,
    eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
  };
});

const { eq } = await import('drizzle-orm');
const { hubSessions } = await import('../../db/schema.js');
const { createHubSessionCipher } = await import('../hub-session-crypto.js');
const { createDrizzleHubSessionPersistence } = await import('../hub-session-persistence.js');

const VALID_KEY = '0123456789abcdef'.repeat(4);

beforeEach(() => {
  selectedRows = [];
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createDrizzleHubSessionPersistence', () => {
  it('writes authenticated ciphertext instead of a plaintext refresh token', async () => {
    const persistence = createDrizzleHubSessionPersistence(VALID_KEY);
    const record: HubSessionRecord = {
      hubRefreshToken: 'rt-plaintext',
      accountId: 'account-1',
    };

    await persistence.put('session-1', record);

    expect(insert).toHaveBeenCalledWith(hubSessions);
    expect(insertValues).toHaveBeenCalledTimes(1);
    const values = insertValues.mock.calls[0]?.[0];
    expect(values).toBeDefined();
    if (!values) {
      throw new Error('Drizzle insert values were not captured');
    }
    const encryptedRefreshToken = values.encryptedRefreshToken as string;
    expect(encryptedRefreshToken).not.toBe('rt-plaintext');
    expect(encryptedRefreshToken).not.toContain('rt-plaintext');
    expect(createHubSessionCipher(VALID_KEY).decrypt(encryptedRefreshToken, 'session-1')).toBe(
      'rt-plaintext',
    );
  });

  it('loads and decrypts a valid row for hydration', async () => {
    const cipher = createHubSessionCipher(VALID_KEY);
    selectedRows = [
      {
        id: 'session-1',
        encryptedRefreshToken: cipher.encrypt('rt-loaded', 'session-1'),
        accountId: 'account-1',
      },
    ];
    const persistence = createDrizzleHubSessionPersistence(VALID_KEY);

    await expect(persistence.loadAll()).resolves.toEqual([
      {
        id: 'session-1',
        hubRefreshToken: 'rt-loaded',
        accountId: 'account-1',
      },
    ]);
  });

  it('skips only a corrupt row and logs no secret material', async () => {
    const cipher = createHubSessionCipher(VALID_KEY);
    const validCiphertext = cipher.encrypt('rt-valid', 'session-valid');
    const corruptCiphertext = cipher.encrypt('rt-corrupt', 'different-session');
    selectedRows = [
      {
        id: 'session-valid',
        encryptedRefreshToken: validCiphertext,
        accountId: 'account-valid',
      },
      {
        id: 'session-corrupt',
        encryptedRefreshToken: corruptCiphertext,
        accountId: 'account-corrupt',
      },
    ];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const persistence = createDrizzleHubSessionPersistence(VALID_KEY);

    await expect(persistence.loadAll()).resolves.toEqual([
      {
        id: 'session-valid',
        hubRefreshToken: 'rt-valid',
        accountId: 'account-valid',
      },
    ]);
    expect(warn).toHaveBeenCalledWith(
      'Skipping corrupt persisted Hub session',
      'session-corrupt',
    );
    const warning = JSON.stringify(warn.mock.calls);
    expect(warning).not.toContain('rt-valid');
    expect(warning).not.toContain('rt-corrupt');
    expect(warning).not.toContain(validCiphertext);
    expect(warning).not.toContain(corruptCiphertext);
    expect(warning).not.toContain(VALID_KEY);
    expect(warning).not.toContain('account-corrupt');
  });

  it('deletes by the opaque session primary key', async () => {
    const persistence = createDrizzleHubSessionPersistence(VALID_KEY);

    await persistence.remove('session-1');

    expect(deleteFrom).toHaveBeenCalledWith(hubSessions);
    expect(eq).toHaveBeenCalledWith(hubSessions.id, 'session-1');
    expect(deleteWhere).toHaveBeenCalledWith({ column: hubSessions.id, value: 'session-1' });
  });
});
