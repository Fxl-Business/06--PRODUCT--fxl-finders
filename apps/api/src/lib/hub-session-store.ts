import type {
  HubLoginTransaction,
  HubSessionRecord,
  HubSessionStore,
} from '@fxl-business/hub-sdk';
import { randomBytes } from 'node:crypto';

export type PersistedHubSession = HubSessionRecord & { id: string };

export interface HubSessionPersistence {
  loadAll(): Promise<PersistedHubSession[]>;
  put(sessionId: string, record: HubSessionRecord): Promise<void>;
  remove(sessionId: string): Promise<void>;
}

export class HubSessionPersistenceError extends Error {
  constructor() {
    super('Hub session persistence failed');
    this.name = 'HubSessionPersistenceError';
  }
}

function generateOpaqueId(): string {
  return randomBytes(32).toString('base64url');
}

export class DurableHubSessionStore implements HubSessionStore {
  private readonly sessions = new Map<string, HubSessionRecord>();
  private readonly logins = new Map<string, HubLoginTransaction>();
  private readonly pendingWrites = new Set<Promise<void>>();
  private orderingTail: Promise<void> = Promise.resolve();

  constructor(private readonly persistence: HubSessionPersistence) {}

  async hydrate(): Promise<void> {
    const persisted = await this.persistence.loadAll();
    this.sessions.clear();
    for (const { id, hubRefreshToken, accountId } of persisted) {
      this.sessions.set(id, {
        hubRefreshToken,
        ...(accountId === undefined ? {} : { accountId }),
      });
    }
  }

  async whenIdle(): Promise<void> {
    const observedWrites = [...this.pendingWrites];
    const results = await Promise.allSettled(observedWrites);
    for (const write of observedWrites) {
      this.pendingWrites.delete(write);
    }
    if (results.some((result) => result.status === 'rejected')) {
      throw new HubSessionPersistenceError();
    }
  }

  create(data: HubSessionRecord): string {
    const sessionId = generateOpaqueId();
    const record = { ...data };
    this.sessions.set(sessionId, record);
    this.enqueueWrite(() => this.persistence.put(sessionId, record));
    return sessionId;
  }

  get(sessionId: string): HubSessionRecord | null {
    const record = this.sessions.get(sessionId);
    return record ? { ...record } : null;
  }

  update(sessionId: string, hubRefreshToken: string): void {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      return;
    }
    const record = { ...existing, hubRefreshToken };
    this.sessions.set(sessionId, record);
    this.enqueueWrite(() => this.persistence.put(sessionId, record));
  }

  delete(sessionId: string): void {
    if (!this.sessions.delete(sessionId)) {
      return;
    }
    this.enqueueWrite(() => this.persistence.remove(sessionId));
  }

  createLogin(transaction: HubLoginTransaction): string {
    const transactionId = generateOpaqueId();
    this.logins.set(transactionId, { ...transaction });
    return transactionId;
  }

  consumeLogin(transactionId: string): HubLoginTransaction | null {
    const transaction = this.logins.get(transactionId);
    if (!transaction) {
      return null;
    }
    this.logins.delete(transactionId);
    return { ...transaction };
  }

  private enqueueWrite(write: () => Promise<void>): void {
    const operation = this.orderingTail.then(write);
    this.pendingWrites.add(operation);
    this.orderingTail = operation.catch(() => undefined);
  }
}
