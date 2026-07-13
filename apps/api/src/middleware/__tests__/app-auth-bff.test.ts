import type { HubSessionRecord } from '@fxl-business/hub-sdk';
import { __clearDiscoveryCache } from '@fxl-business/hub-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  HubSessionPersistence,
  PersistedHubSession,
} from '../../lib/hub-session-store.js';

const HUB_AUTH_CONFIG = {
  apiUrl: 'https://hub.test',
  publishableKey: 'pk_fxl-sales_test',
  secretKey: 'sk_test',
  audience: 'product.fxl-sales',
  coreModule: 'sales.core',
};

vi.mock('../../config/auth-provider.js', () => ({
  tryLoadHubAuthConfig: () => HUB_AUTH_CONFIG,
}));

const { createAppAuthBff } = await import('../app-auth.js');

class FakePersistence implements HubSessionPersistence {
  readonly records = new Map<string, HubSessionRecord>();
  readonly puts: Array<{ sessionId: string; record: HubSessionRecord }> = [];
  readonly removals: string[] = [];

  async loadAll(): Promise<PersistedHubSession[]> {
    return [...this.records].map(([id, record]) => ({ id, ...record }));
  }

  async put(sessionId: string, record: HubSessionRecord): Promise<void> {
    this.puts.push({ sessionId, record: { ...record } });
    this.records.set(sessionId, { ...record });
  }

  async remove(sessionId: string): Promise<void> {
    this.removals.push(sessionId);
    this.records.delete(sessionId);
  }
}

type HubReply = { status?: number; rotatedRefreshToken?: string };

function createFakeHubFetch(replies: HubReply[] = []) {
  const refreshTokensSent: string[] = [];
  const fetchImpl: typeof fetch = vi.fn(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/.well-known/oauth-authorization-server')) {
      return Response.json({
        issuer: 'https://hub.test',
        authorization_endpoint: 'https://hub.test/oauth/authorize',
        token_endpoint: 'https://hub.test/oauth/token',
        fxl_web_url: 'https://hub-web.test',
      });
    }

    if (url.startsWith('https://hub.test/auth/refresh')) {
      const headers = new Headers(init?.headers);
      refreshTokensSent.push(headers.get('cookie') ?? '');
      const reply = replies.shift() ?? {};
      if (reply.status === 401) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
      }
      const responseHeaders = new Headers({ 'content-type': 'application/json' });
      if (reply.rotatedRefreshToken) {
        responseHeaders.set('set-cookie', `fxl_hub_session=${reply.rotatedRefreshToken}; Path=/`);
      }
      return new Response(JSON.stringify({ accessToken: 'at-test', expiresIn: 300 }), {
        status: 200,
        headers: responseHeaders,
      });
    }

    if (url === 'https://hub.test/auth/logout') {
      return new Response(null, { status: 204 });
    }

    throw new Error(`Unexpected Hub request: ${url}`);
  });

  return { fetchImpl, refreshTokensSent };
}

async function refresh(router: NonNullable<Awaited<ReturnType<typeof createAppAuthBff>>>) {
  return router.request('/auth/refresh', {
    method: 'POST',
    headers: { cookie: 'fxl_hub_session=session-1' },
  });
}

beforeEach(() => {
  __clearDiscoveryCache();
});

describe('createAppAuthBff durable session wiring', () => {
  it('hydrates a persisted session before the real SDK refresh route runs', async () => {
    const persistence = new FakePersistence();
    persistence.records.set('session-1', { hubRefreshToken: 'rt-old', accountId: 'account-1' });
    const hub = createFakeHubFetch();

    const router = await createAppAuthBff({ persistence, fetchImpl: hub.fetchImpl });
    const response = await refresh(router!);

    expect(response.status).toBe(200);
    expect(hub.refreshTokensSent).toEqual(['fxl_hub_session=rt-old']);
  });

  it('persists a rotated refresh token and restores it in a fresh BFF process', async () => {
    const persistence = new FakePersistence();
    persistence.records.set('session-1', { hubRefreshToken: 'rt-old', accountId: 'account-1' });
    const firstHub = createFakeHubFetch([{ rotatedRefreshToken: 'rt-rotated' }]);
    const firstRouter = await createAppAuthBff({
      persistence,
      fetchImpl: firstHub.fetchImpl,
    });

    expect((await refresh(firstRouter!)).status).toBe(200);
    await vi.waitFor(() => {
      expect(persistence.records.get('session-1')?.hubRefreshToken).toBe('rt-rotated');
    });

    __clearDiscoveryCache();
    const secondHub = createFakeHubFetch();
    const secondRouter = await createAppAuthBff({
      persistence,
      fetchImpl: secondHub.fetchImpl,
    });
    expect((await refresh(secondRouter!)).status).toBe(200);
    expect(secondHub.refreshTokensSent).toEqual(['fxl_hub_session=rt-rotated']);
  });

  it('removes logout state so a fresh BFF rejects the old cookie', async () => {
    const persistence = new FakePersistence();
    persistence.records.set('session-1', { hubRefreshToken: 'rt-old' });
    const firstHub = createFakeHubFetch();
    const firstRouter = await createAppAuthBff({
      persistence,
      fetchImpl: firstHub.fetchImpl,
    });

    const logoutResponse = await firstRouter!.request('/auth/logout', {
      method: 'POST',
      headers: { cookie: 'fxl_hub_session=session-1' },
    });
    expect(logoutResponse.status).toBe(204);
    await vi.waitFor(() => expect(persistence.records.has('session-1')).toBe(false));

    const secondRouter = await createAppAuthBff({ persistence, fetchImpl: firstHub.fetchImpl });
    const response = await refresh(secondRouter!);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'no_session' });
  });

  it('removes a Hub-rejected session so a fresh BFF rejects the old cookie', async () => {
    const persistence = new FakePersistence();
    persistence.records.set('session-1', { hubRefreshToken: 'rt-old' });
    const firstHub = createFakeHubFetch([{ status: 401 }]);
    const firstRouter = await createAppAuthBff({
      persistence,
      fetchImpl: firstHub.fetchImpl,
    });

    expect((await refresh(firstRouter!)).status).toBe(401);
    await vi.waitFor(() => expect(persistence.records.has('session-1')).toBe(false));

    const secondRouter = await createAppAuthBff({ persistence, fetchImpl: firstHub.fetchImpl });
    const response = await refresh(secondRouter!);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'no_session' });
  });

  it('does not resolve BFF creation until hydration completes', async () => {
    let releaseHydration!: (rows: PersistedHubSession[]) => void;
    const persistence: HubSessionPersistence = {
      loadAll: () =>
        new Promise<PersistedHubSession[]>((resolve) => {
          releaseHydration = resolve;
        }),
      put: async () => undefined,
      remove: async () => undefined,
    };
    const hub = createFakeHubFetch();
    let resolved = false;

    const pendingRouter = createAppAuthBff({ persistence, fetchImpl: hub.fetchImpl }).then(
      (router) => {
        resolved = true;
        return router;
      },
    );
    await Promise.resolve();
    expect(resolved).toBe(false);

    releaseHydration([]);
    await expect(pendingRouter).resolves.not.toBeNull();
    expect(resolved).toBe(true);
  });
});
