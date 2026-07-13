import type { HubLoginTransaction, HubSessionRecord } from '@fxl-business/hub-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DurableHubSessionStore,
  type HubSessionPersistence,
  type PersistedHubSession,
} from '../hub-session-store.js';

type PersistenceCall =
  | { operation: 'loadAll' }
  | { operation: 'put'; sessionId: string; record: HubSessionRecord }
  | { operation: 'remove'; sessionId: string };

class FakePersistence implements HubSessionPersistence {
  readonly records = new Map<string, HubSessionRecord>();
  readonly calls: PersistenceCall[] = [];

  async loadAll(): Promise<PersistedHubSession[]> {
    this.calls.push({ operation: 'loadAll' });
    return [...this.records].map(([id, record]) => ({ id, ...record }));
  }

  async put(sessionId: string, record: HubSessionRecord): Promise<void> {
    this.calls.push({ operation: 'put', sessionId, record: { ...record } });
    this.records.set(sessionId, { ...record });
  }

  async remove(sessionId: string): Promise<void> {
    this.calls.push({ operation: 'remove', sessionId });
    this.records.delete(sessionId);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DurableHubSessionStore', () => {
  it('creates a unique base64url session id with at least 128 bits and reads it synchronously', () => {
    const persistence = new FakePersistence();
    const store = new DurableHubSessionStore(persistence);
    const record = { hubRefreshToken: 'rt-created', accountId: 'account-1' };

    const firstId = store.create(record);
    const secondId = store.create(record);

    expect(firstId).not.toBe(secondId);
    expect(firstId).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(firstId, 'base64url').byteLength).toBeGreaterThanOrEqual(16);
    expect(store.get(firstId)).toEqual(record);
  });

  it('hydrates a fresh store from the same persistence using the original id', async () => {
    const persistence = new FakePersistence();
    const firstStore = new DurableHubSessionStore(persistence);
    const sessionId = firstStore.create({
      hubRefreshToken: 'rt-original',
      accountId: 'account-1',
    });
    await firstStore.whenIdle();

    const secondStore = new DurableHubSessionStore(persistence);
    expect(secondStore.get(sessionId)).toBeNull();

    await secondStore.hydrate();

    expect(secondStore.get(sessionId)).toEqual({
      hubRefreshToken: 'rt-original',
      accountId: 'account-1',
    });
  });

  it('hydrates only the latest rotated refresh token', async () => {
    const persistence = new FakePersistence();
    const firstStore = new DurableHubSessionStore(persistence);
    const sessionId = firstStore.create({ hubRefreshToken: 'rt-old', accountId: 'account-1' });
    await firstStore.whenIdle();

    firstStore.update(sessionId, 'rt-rotated');
    await firstStore.whenIdle();

    const secondStore = new DurableHubSessionStore(persistence);
    await secondStore.hydrate();

    expect(secondStore.get(sessionId)).toEqual({
      hubRefreshToken: 'rt-rotated',
      accountId: 'account-1',
    });
  });

  it('does not resurrect a deleted persisted session after hydration', async () => {
    const persistence = new FakePersistence();
    const firstStore = new DurableHubSessionStore(persistence);
    const sessionId = firstStore.create({ hubRefreshToken: 'rt-to-delete' });
    await firstStore.whenIdle();

    firstStore.delete(sessionId);
    await firstStore.whenIdle();

    const secondStore = new DurableHubSessionStore(persistence);
    await secondStore.hydrate();

    expect(secondStore.get(sessionId)).toBeNull();
  });

  it('serializes synchronous create, update, and delete calls at the persistence port', async () => {
    const persistence = new FakePersistence();
    const store = new DurableHubSessionStore(persistence);

    const sessionId = store.create({ hubRefreshToken: 'rt-old', accountId: 'account-1' });
    store.update(sessionId, 'rt-new');
    store.delete(sessionId);
    await store.whenIdle();

    expect(persistence.calls).toEqual([
      {
        operation: 'put',
        sessionId,
        record: { hubRefreshToken: 'rt-old', accountId: 'account-1' },
      },
      {
        operation: 'put',
        sessionId,
        record: { hubRefreshToken: 'rt-new', accountId: 'account-1' },
      },
      { operation: 'remove', sessionId },
    ]);
  });

  it('logs a token-free write failure without throwing through synchronous callers', async () => {
    const persistence: HubSessionPersistence = {
      loadAll: async () => [],
      put: async () => {
        throw new Error('database unavailable');
      },
      remove: async () => undefined,
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = new DurableHubSessionStore(persistence);

    const sessionId = store.create({ hubRefreshToken: 'rt-never-log', accountId: 'account-1' });
    expect(() => store.update(sessionId, 'rt-also-secret')).not.toThrow();
    await store.whenIdle();

    expect(store.get(sessionId)).toEqual({
      hubRefreshToken: 'rt-also-secret',
      accountId: 'account-1',
    });
    expect(warn).toHaveBeenCalled();
    const warning = JSON.stringify(warn.mock.calls);
    expect(warning).toContain('Hub session persistence write failed');
    expect(warning).not.toContain('rt-never-log');
    expect(warning).not.toContain('rt-also-secret');
  });

  it('keeps login transactions in memory, single-use, and outside persistence', () => {
    const persistence = new FakePersistence();
    const store = new DurableHubSessionStore(persistence);
    const transaction: HubLoginTransaction = {
      codeVerifier: 'pkce-verifier',
      state: 'csrf-state',
    };

    const transactionId = store.createLogin(transaction);

    expect(store.consumeLogin(transactionId)).toEqual(transaction);
    expect(store.consumeLogin(transactionId)).toBeNull();
    expect(persistence.calls).toEqual([]);
  });
});
