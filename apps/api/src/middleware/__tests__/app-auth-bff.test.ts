import type { HubSessionRecord } from '@fxl-business/hub-sdk';
import { __clearDiscoveryCache } from '@fxl-business/hub-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

type PersistenceWrite =
  | { operation: 'put'; sessionId: string; record: HubSessionRecord }
  | { operation: 'remove'; sessionId: string };

class FakePersistence implements HubSessionPersistence {
  readonly records = new Map<string, HubSessionRecord>();
  readonly writes: PersistenceWrite[] = [];
  private nextControl:
    | { started: Deferred<PersistenceWrite>; settlement: Deferred<void> }
    | undefined;

  async loadAll(): Promise<PersistedHubSession[]> {
    return [...this.records].map(([id, record]) => ({ id, ...record }));
  }

  async put(sessionId: string, record: HubSessionRecord): Promise<void> {
    const write: PersistenceWrite = { operation: 'put', sessionId, record: { ...record } };
    this.writes.push(write);
    await this.awaitControl(write);
    this.records.set(sessionId, { ...record });
  }

  async remove(sessionId: string): Promise<void> {
    const write: PersistenceWrite = { operation: 'remove', sessionId };
    this.writes.push(write);
    await this.awaitControl(write);
    this.records.delete(sessionId);
  }

  controlNextWrite() {
    if (this.nextControl) {
      throw new Error('A persistence write is already controlled');
    }
    const started = deferred<PersistenceWrite>();
    const settlement = deferred<void>();
    this.nextControl = { started, settlement };
    return {
      started: started.promise,
      release: () => settlement.resolve(undefined),
      reject: (error: unknown) => settlement.reject(error),
    };
  }

  private async awaitControl(write: PersistenceWrite): Promise<void> {
    const control = this.nextControl;
    if (!control) {
      return;
    }
    this.nextControl = undefined;
    control.started.resolve(write);
    await control.settlement.promise;
  }
}

type HubReply = { status?: number; rotatedRefreshToken?: string };

function createFakeHubFetch(options?: {
  refreshReplies?: HubReply[];
  callbackRefreshToken?: string;
}) {
  const refreshReplies = [...(options?.refreshReplies ?? [])];
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

    if (url === 'https://hub.test/oauth/token') {
      return Response.json({
        access_token: 'at-callback',
        refresh_token: options?.callbackRefreshToken ?? 'rt-callback',
      });
    }

    if (url.startsWith('https://hub.test/auth/refresh')) {
      const headers = new Headers(init?.headers);
      refreshTokensSent.push(headers.get('cookie') ?? '');
      const reply = refreshReplies.shift() ?? {};
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

type AppAuthRouter = NonNullable<Awaited<ReturnType<typeof createAppAuthBff>>>;

function refresh(router: AppAuthRouter, sessionId = 'session-1') {
  return router.request('/auth/refresh', {
    method: 'POST',
    headers: { cookie: `fxl_hub_session=${sessionId}` },
  });
}

function logout(router: AppAuthRouter, sessionId = 'session-1') {
  return router.request('/auth/logout', {
    method: 'POST',
    headers: { cookie: `fxl_hub_session=${sessionId}` },
  });
}

async function callbackRequest(router: AppAuthRouter): Promise<{
  callbackUrl: string;
  loginCookie: string;
}> {
  const loginResponse = await router.request('/auth/login');
  const location = loginResponse.headers.get('location');
  const setCookie = loginResponse.headers.get('set-cookie');
  expect(loginResponse.status).toBe(302);
  expect(location).toBeTruthy();
  expect(setCookie).toBeTruthy();
  const authorizationUrl = new URL(location!);
  const state = authorizationUrl.searchParams.get('state');
  const transactionId = /fxl_hub_login=([^;]+)/.exec(setCookie!)?.[1];
  expect(state).toBeTruthy();
  expect(transactionId).toBeTruthy();
  return {
    callbackUrl: `/auth/callback?code=callback-code&state=${encodeURIComponent(state!)}`,
    loginCookie: `fxl_hub_login=${transactionId}`,
  };
}

function trackResponse(responseOrPromise: Response | Promise<Response>) {
  let settled = false;
  return {
    promise: Promise.resolve(responseOrPromise).then((response) => {
      settled = true;
      return response;
    }),
    isSettled: () => settled,
  };
}

async function eventLoopTurn(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function expectSessionCookieCleared(response: Response): void {
  const setCookie = response.headers.get('set-cookie') ?? '';
  expect(setCookie).toMatch(/(?:__Host-)?fxl_hub_session=;/);
  expect(setCookie).toMatch(/Max-Age=0/i);
  expect(setCookie).not.toMatch(/(?:__Host-)?fxl_hub_session=[A-Za-z0-9_-]+/);
}

beforeEach(() => {
  __clearDiscoveryCache();
});

afterEach(() => {
  vi.restoreAllMocks();
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

  it('holds a rotated refresh response until update persistence is durable', async () => {
    const persistence = new FakePersistence();
    persistence.records.set('session-1', { hubRefreshToken: 'rt-old', accountId: 'account-1' });
    const hub = createFakeHubFetch({
      refreshReplies: [{ rotatedRefreshToken: 'rt-rotated' }],
    });
    const router = await createAppAuthBff({ persistence, fetchImpl: hub.fetchImpl });
    const control = persistence.controlNextWrite();

    const tracked = trackResponse(refresh(router!));
    await expect(control.started).resolves.toMatchObject({
      operation: 'put',
      record: { hubRefreshToken: 'rt-rotated' },
    });
    await eventLoopTurn();
    const stayedPending = !tracked.isSettled();
    control.release();
    const response = await tracked.promise;

    expect(stayedPending).toBe(true);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ accessToken: 'at-test' });

    __clearDiscoveryCache();
    const freshHub = createFakeHubFetch();
    const freshRouter = await createAppAuthBff({
      persistence,
      fetchImpl: freshHub.fetchImpl,
    });
    expect((await refresh(freshRouter!)).status).toBe(200);
    expect(freshHub.refreshTokensSent).toEqual(['fxl_hub_session=rt-rotated']);
  });

  it('holds callback success until create persistence is durable', async () => {
    const persistence = new FakePersistence();
    const hub = createFakeHubFetch({ callbackRefreshToken: 'rt-callback' });
    const router = await createAppAuthBff({ persistence, fetchImpl: hub.fetchImpl });
    const callback = await callbackRequest(router!);
    const control = persistence.controlNextWrite();

    const tracked = trackResponse(
      router!.request(callback.callbackUrl, {
        headers: { cookie: callback.loginCookie },
      }),
    );
    const write = await control.started;
    expect(write).toMatchObject({
      operation: 'put',
      record: { hubRefreshToken: 'rt-callback' },
    });
    await eventLoopTurn();
    const stayedPending = !tracked.isSettled();
    control.release();
    const response = await tracked.promise;

    expect(stayedPending).toBe(true);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/');
    const sessionId = /fxl_hub_session=([^;]+)/.exec(
      response.headers.get('set-cookie') ?? '',
    )?.[1];
    expect(sessionId).toBe(write.sessionId);

    __clearDiscoveryCache();
    const freshHub = createFakeHubFetch();
    const freshRouter = await createAppAuthBff({
      persistence,
      fetchImpl: freshHub.fetchImpl,
    });
    expect((await refresh(freshRouter!, sessionId)).status).toBe(200);
    expect(freshHub.refreshTokensSent).toEqual(['fxl_hub_session=rt-callback']);
  });

  it('holds logout acknowledgement until delete persistence is durable', async () => {
    const persistence = new FakePersistence();
    persistence.records.set('session-1', { hubRefreshToken: 'rt-old' });
    const hub = createFakeHubFetch();
    const router = await createAppAuthBff({ persistence, fetchImpl: hub.fetchImpl });
    const control = persistence.controlNextWrite();

    const tracked = trackResponse(logout(router!));
    await expect(control.started).resolves.toEqual({
      operation: 'remove',
      sessionId: 'session-1',
    });
    await eventLoopTurn();
    const stayedPending = !tracked.isSettled();
    control.release();
    const response = await tracked.promise;

    expect(stayedPending).toBe(true);
    expect(response.status).toBe(204);

    const freshRouter = await createAppAuthBff({ persistence, fetchImpl: hub.fetchImpl });
    const freshResponse = await refresh(freshRouter!);
    expect(freshResponse.status).toBe(401);
    await expect(freshResponse.json()).resolves.toEqual({ error: 'no_session' });
  });

  it('holds a Hub 401 response until delete persistence is durable', async () => {
    const persistence = new FakePersistence();
    persistence.records.set('session-1', { hubRefreshToken: 'rt-old' });
    const hub = createFakeHubFetch({ refreshReplies: [{ status: 401 }] });
    const router = await createAppAuthBff({ persistence, fetchImpl: hub.fetchImpl });
    const control = persistence.controlNextWrite();

    const tracked = trackResponse(refresh(router!));
    await expect(control.started).resolves.toEqual({
      operation: 'remove',
      sessionId: 'session-1',
    });
    await eventLoopTurn();
    const stayedPending = !tracked.isSettled();
    control.release();
    const response = await tracked.promise;

    expect(stayedPending).toBe(true);
    expect(response.status).toBe(401);

    __clearDiscoveryCache();
    const freshRouter = await createAppAuthBff({ persistence, fetchImpl: hub.fetchImpl });
    const freshResponse = await refresh(freshRouter!);
    expect(freshResponse.status).toBe(401);
    await expect(freshResponse.json()).resolves.toEqual({ error: 'no_session' });
  });

  it.each(['callback', 'refresh', 'logout', 'refresh-401'] as const)(
    'fails %s closed when its persistence operation rejects',
    async (scenario) => {
      const persistence = new FakePersistence();
      if (scenario !== 'callback') {
        persistence.records.set('session-1', {
          hubRefreshToken: 'rt-old',
          accountId: 'account-secret',
        });
      }
      const hub = createFakeHubFetch({
        callbackRefreshToken: 'rt-callback',
        refreshReplies:
          scenario === 'refresh'
            ? [{ rotatedRefreshToken: 'rt-rotated' }]
            : scenario === 'refresh-401'
              ? [{ status: 401 }]
              : [],
      });
      const router = await createAppAuthBff({ persistence, fetchImpl: hub.fetchImpl });
      const callback = scenario === 'callback' ? await callbackRequest(router!) : undefined;
      const control = persistence.controlNextWrite();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      const request =
        scenario === 'callback'
          ? router!.request(callback!.callbackUrl, {
              headers: { cookie: callback!.loginCookie },
            })
          : scenario === 'logout'
            ? logout(router!)
            : refresh(router!);
      const write = await control.started;
      control.reject(
        new Error(
          'database exploded with session-1 rt-old rt-rotated ciphertext-secret key-secret account-secret',
        ),
      );
      const response = await request;

      expect(response.status).toBe(503);
      await expect(response.clone().json()).resolves.toEqual({
        error: 'unavailable',
        code: 'session_persistence_failed',
      });
      expect(response.headers.get('location')).toBeNull();
      expectSessionCookieCleared(response);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith('Hub session persistence failed');
      const exposed = [
        JSON.stringify(warn.mock.calls),
        await response.clone().text(),
        response.headers.get('set-cookie') ?? '',
      ].join(' ');
      for (const secret of [
        write.sessionId,
        'session-1',
        'rt-old',
        'rt-rotated',
        'rt-callback',
        'ciphertext-secret',
        'key-secret',
        'account-secret',
        'database exploded',
      ]) {
        expect(exposed).not.toContain(secret);
      }
    },
  );

  it('allows a later auth write to complete after an observed persistence rejection', async () => {
    const persistence = new FakePersistence();
    persistence.records.set('session-1', { hubRefreshToken: 'rt-old' });
    const hub = createFakeHubFetch({
      refreshReplies: [
        { rotatedRefreshToken: 'rt-failed' },
        { rotatedRefreshToken: 'rt-recovered' },
      ],
    });
    const router = await createAppAuthBff({ persistence, fetchImpl: hub.fetchImpl });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const control = persistence.controlNextWrite();

    const failedRequest = refresh(router!);
    await control.started;
    control.reject(new Error('transient database failure'));
    expect((await failedRequest).status).toBe(503);

    const recoveredResponse = await refresh(router!);
    expect(recoveredResponse.status).toBe(200);
    expect(persistence.records.get('session-1')).toEqual({
      hubRefreshToken: 'rt-recovered',
    });
    expect(warn).toHaveBeenCalledTimes(1);
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
