---
id: 01-browser-token-cache
milestone: null
status: done
depends_on: []
files_modified: [apps/web/package.json, apps/web/vitest.config.ts, apps/web/src/auth/token.ts, apps/web/src/auth/react.tsx, apps/web/src/auth/__tests__/token.test.ts, apps/web/src/auth/__tests__/react.test.tsx, pnpm-lock.yaml]
acceptance: "Given protected browser operations share one auth client, when they request an uncached token concurrently, reuse a JWT outside its expiry safety skew, issue overlapping workspace switches, receive an unrecoverable null response, or log out during a switch, then one refresh serves concurrent callers, fresh JWTs avoid refresh, only the newest requested switch may replace workspace state, and cleared authentication leaves no reusable browser token"
---

# Slice 01 - Browser Token Cache

## Goal

Stop ordinary query, mutation, and focus-refetch bursts from rotating the Hub refresh token repeatedly while keeping workspace switches and authentication clearing authoritative.

## Root Cause

`HubAuthProvider` currently calls `client.getToken()` directly during startup and through every consumer of `useAccessToken`.
The Hub SDK intentionally performs `POST /auth/refresh` on every `getToken()` call and has no browser token cache or request coalescing.
Concurrent protected operations therefore race multiple refreshes against the same rotating BFF session.
Every successful refresh is also discarded immediately, so even a JWT that remains safely valid causes another network refresh on the next query, mutation, or focus refetch.
When a refresh resolves `null`, the React adapter clears the profile and `Protected` starts login navigation, which exposes the race as an apparent reload.

## Design

Add a small React-free token cache factory in `apps/web/src/auth/token.ts`.
One cache instance belongs to the single Hub browser client created by `HubAuthProvider`.
The factory accepts only `Pick<HubClient, 'getToken'>` and returns `getToken`, `seed`, and `clear` methods.
It stores an access token, its absolute expiry, one in-flight refresh promise, and a generation counter in the factory closure.

Use a 30-second expiry safety skew.
For a normal refresh, cache only a JWT with a finite numeric `exp` claim, and treat `exp` only as an unverified cache-lifetime hint.
An opaque or malformed refreshed token may be returned to its initiating caller but must not be reused from memory.
For a successful workspace switch, `seed(accessToken, expiresIn)` may use the server-reported positive finite lifetime as a fallback when JWT `exp` is unavailable.
When both values exist, use the earlier expiry so the cache cannot outlive either signal.

All callers arriving during a cache miss share one in-flight refresh.
`seed` and `clear` increment the generation so a refresh started under an older workspace or session cannot overwrite newer state when it resolves.
A superseded refresh returns the current fresh seeded token, or `null` after a clear, to prevent React from applying stale profile claims.

Wire every React token read, including the initial session load, through the cache.
Seed the cache from `client.setActive()` before applying the switched token to React state.
Clear the cache and React auth state before awaiting `client.logout()` so logout remains authoritative even if an unexpected client error occurs.
Continue applying `null` to React state when a cached getter receives an unrecoverable `null` response.

Add one provider-local monotonic operation generation in `react.tsx` with `useRef`.
Each workspace-switch request increments the generation before awaiting `client.setActive()` and captures its value.
The response may call `tokenCache.seed` and `applyToken` only when its captured generation still equals the current generation.
Logout increments the same generation before clearing the cache, clearing React auth state, or calling the SDK, so every earlier switch response becomes stale immediately.
This ordering is separate from the token cache's existing generation and must not change refresh coalescing, expiry, seed, or clear behavior.

## Interfaces

`apps/web/src/auth/token.ts` exports:

```ts
export const ACCESS_TOKEN_EXPIRY_SKEW_MS = 30_000;

export type HubAccessTokenCache = {
  getToken: () => Promise<string | null>;
  seed: (accessToken: string, expiresInSeconds: number) => void;
  clear: () => void;
};

export function createHubAccessTokenCache(
  client: Pick<HubClient, 'getToken'>,
): HubAccessTokenCache;
```

No cache internals or mutable singleton state are exported.

## RED Test Contract

Create `apps/web/src/auth/__tests__/token.test.ts` before creating the implementation module.
Use a typed fake `getToken`, controllable deferred promises, fake system time, and locally generated base64url JWT payloads.
Reset fake timers and mocks after every test so module behavior cannot leak between cases.

Lock these exact cases as the oracle:

1. `coalesces concurrent cache misses into one SDK refresh`
   Start three `getToken()` calls before resolving the fake client promise.
   Resolve one fresh JWT and assert all three calls receive the same token while the client is called exactly once.
2. `serves a fresh JWT from memory until the expiry skew boundary`
   Fetch a JWT with a known `exp`, call again one millisecond before `exp - ACCESS_TOKEN_EXPIRY_SKEW_MS`, and assert there is no second client call.
   Move time to the exact skew boundary, return a newer JWT, and assert one new refresh occurs.
3. `does not cache a normal refresh token without a valid JWT expiry`
   Return an opaque token twice and assert each sequential getter calls the client while still returning the client value.
4. `clears cached state when the client resolves null`
   Cache a JWT, advance to its refresh boundary, resolve `null`, and assert the getter returns `null`.
   Make the following client call return a new JWT and assert the cache did not retain the old token.
5. `clear discards a cached token and a late in-flight refresh result`
   Prove `clear()` forces a new call after a cached token.
   Then clear while a refresh is pending, resolve that old refresh with a JWT, and assert the pending getter resolves `null` and the stale JWT is not cached.
6. `seed makes the workspace-switch token authoritative over an older in-flight refresh`
   Start a deferred refresh, seed a different workspace token with `expiresIn`, and then resolve the older refresh with either a stale JWT or `null` in table-driven variants.
   Assert the pending getter and the next getter both return the seeded workspace token and no extra client call occurs.
7. `seed uses the earlier JWT or server expiry and rejects immortal fallback lifetimes`
   Assert a seeded JWT stops being reusable at its JWT skew boundary even when `expiresIn` is longer.
   Assert an opaque token uses a positive finite `expiresIn` fallback.
   Assert zero, negative, `NaN`, and infinite lifetimes do not create a reusable opaque-token cache entry.

Create `apps/web/src/auth/__tests__/react.test.tsx` as the provider-level wiring oracle.
Mark this file with the Vitest `happy-dom` environment directive.
Use `react-dom/client`, React `act`, the public auth exports, and Vitest module mocks instead of adding a component testing framework.
Mock `createHubClient` with one stable fake client and mock `createHubAccessTokenCache` with stable `getToken`, `seed`, and `clear` spies.
Render `AppAuthProvider` with a probe that reads `useAuthProfile()` and with `UserControls` for workspace and logout interactions.
Unmount the root and restore mocks after every test.

Lock these exact provider cases as part of the same oracle:

8. `hydrates the provider through the token cache instead of the SDK client`
   Make the cache getter resolve a JWT with profile claims, render the provider, and assert the cache factory receives the fake Hub client and its getter is called once.
   Assert the SDK client's direct `getToken` spy is never called and the probe renders the authenticated profile.
9. `seeds the workspace-switch token before exposing the switched profile`
   Hydrate with claims for two workspaces, make `client.setActive` resolve `{ accessToken, expiresIn, workspaceId }`, and dispatch the workspace select change.
   Have the cache `seed` spy and the probe's workspace observation spy record Vitest invocation order.
   Assert `seed(accessToken, expiresIn)` is called exactly once after `setActive` and before the probe observes claims from the switched token, without an extra cached getter or direct SDK refresh.
10. `clears browser token state before SDK logout`
    Click the rendered logout button while `client.logout` is controlled by a deferred promise.
    Assert the cache `clear` invocation precedes the SDK `logout` invocation, the probe becomes signed out before the deferred SDK call resolves, and resolving logout does not restore authentication.
11. `does not restore authentication when a workspace switch resolves after logout begins`
    Hydrate with at least two workspaces and make `client.setActive` return a deferred promise.
    Dispatch a workspace change, confirm the switch request has started, and click logout before resolving the switch.
    Assert the cache is cleared and the probe is signed out before resolving either deferred operation.
    Resolve the late switch with a valid `{ accessToken, expiresIn, workspaceId }` result while SDK logout is still pending.
    Assert `seed` was never called for the late token, the switched workspace was never observed, and the profile remains signed out after both promises settle.
12. `keeps the newest requested workspace authoritative when switches resolve out of order`
    Hydrate with three workspaces and dispatch switches to the second and then the third workspace without resolving either request.
    Resolve the third-workspace request first and assert its token is seeded once before its profile is observed.
    Resolve the older second-workspace request last and assert it causes no additional seed, the second workspace profile is never observed, and the third workspace remains active.

Add `happy-dom` as an exact web development dependency with `pnpm --filter @fxl-sales/web add --save-dev --save-exact happy-dom` so the workspace manifest and lockfile update together.
Change `apps/web/vitest.config.ts` to include both `src/**/__tests__/**/*.test.ts` and `src/**/__tests__/**/*.test.tsx` while retaining `node` as the default environment for all other tests.

Run the focused oracle in RED:

```bash
pnpm --filter @fxl-sales/web test -- src/auth/__tests__/token.test.ts src/auth/__tests__/react.test.tsx
```

Expected RED result: the factory suite initially fails because `apps/web/src/auth/token.ts` does not exist, and once the minimal module surface resolves, the provider suite still fails because `react.tsx` bypasses the cache, never seeds or clears it, and allows stale switch responses to restore or replace auth state.
Both test files become the locked oracle after these failures and must not be weakened during Green.

## GREEN Implementation Steps

- [ ] Add `apps/web/src/auth/token.ts` with the exact public interface above and no React import.
- [ ] Add `happy-dom` to `apps/web/package.json`, regenerate `pnpm-lock.yaml`, and extend `apps/web/vitest.config.ts` to discover `.test.tsx` files.
- [ ] Decode only the JWT payload segment with base64url normalization and safe JSON parsing.
- [ ] Accept `exp` only when it is a finite number, convert seconds to epoch milliseconds, and never use it for identity or authorization decisions.
- [ ] Return the cached token only when `Date.now() < expiresAt - ACCESS_TOKEN_EXPIRY_SKEW_MS`.
- [ ] Create one refresh promise on a cache miss and return that in-flight work to every concurrent caller.
- [ ] Clear the in-flight reference in `finally`, guarded by promise identity so an older completion cannot erase newer work.
- [ ] Cache a normal refreshed token only when it has a valid JWT expiry.
- [ ] On an active-generation `null` result, remove cached state and return `null`.
- [ ] Make `seed` increment the generation and store the workspace token with the earlier valid JWT or positive finite server expiry.
- [ ] Make `clear` increment the generation and remove cached state so a late refresh resolves to `null` instead of repopulating the cache.
- [ ] If a refresh generation was superseded, ignore its value and return the currently fresh seeded token or `null`.
- [ ] In `apps/web/src/auth/react.tsx`, create one cache instance with the memoized Hub client.
- [ ] Route the provider's public getter and its initial load effect through the cached getter, preserving `applyToken(token)` for both token and `null` results.
- [ ] Add a `useRef(0)` operation generation owned only by `HubAuthProvider`.
- [ ] At the start of each `setActive(workspaceId)`, increment the operation generation and capture that switch's generation before awaiting `client.setActive`.
- [ ] After `client.setActive(workspaceId)` succeeds, return without side effects when its captured generation is stale.
- [ ] For the current switch only, seed `result.accessToken` with `result.expiresIn` before applying the token to React state.
- [ ] At the start of logout, increment the operation generation before clearing the token cache, calling `applyToken(null)`, and awaiting the SDK logout request.
- [ ] Leave the token cache generation, refresh coalescing, expiry calculation, `seed`, and `clear` implementation unchanged while adding provider operation ordering.
- [ ] Run both focused oracle files until all cases pass without editing the locked expectations.
- [ ] Run the web TypeScript check to prove the React wiring matches the SDK `SetActiveResult` surface.

## Refactor Limits

Refactor only after the focused oracle is green.
Keep the cache factory in one focused module and keep profile parsing in `react.tsx` and `claims.ts` unchanged.
Do not introduce a state library, storage adapter, timer, background refresh loop, retry policy, or new dependency.
Do not change the public exports from `react.tsx` or the behavior of `Protected` in this slice.
Do not move Hub client construction or generalize the cache beyond one browser Hub client.

## Security Notes

Keep access tokens in memory only.
Never write access tokens or expiry metadata to `localStorage`, `sessionStorage`, IndexedDB, cookies, logs, or error messages.
JWT payload decoding is unverified and is permitted only to shorten cache reuse.
API and Hub signature verification remain the authorization boundary.
Malformed tokens and invalid lifetime values must fail closed for reuse by remaining uncached.
Logout and unrecoverable `null` responses must remove browser cache state, and generation invalidation must prevent older requests from restoring it.
The browser's HttpOnly cookie contains only an opaque BFF session id.
The refresh token remains exclusively in the server-side session store and is never placed in a browser cookie or browser-readable storage.

## Verification

The exact focused Gate 2 command for this slice is:

```bash
pnpm --filter @fxl-sales/web test -- src/auth/__tests__/token.test.ts src/auth/__tests__/react.test.tsx
```

Expected result: both test files pass and all twelve named behaviors pass.
The result must prove concurrent callers produce one SDK refresh, fresh JWT reuse produces no refresh, clear or seed defeats late stale refresh results, initial hydration uses the cache, workspace switching seeds it, logout clears it before calling the SDK, a late switch cannot restore logged-out auth, and only the newest requested switch may update cache and profile state.

The executor should also run:

```bash
pnpm --filter @fxl-sales/web type-check
pnpm --filter @fxl-sales/web lint
```

These secondary checks prove the provider wiring compiles and follows repository lint rules.
The separate Verify agent remains responsible for the objective Gate 2 verdict and the wave-level full suite.

## Out of Scope

- Durable BFF session persistence and hydration across API restarts, covered by slice `02-durable-bff-session-store`.
- Server-side removal of persisted session state, which is the server portion of acceptance criterion 5.
- Changes to Hub OAuth navigation, refresh-token rotation, access-token lifetime, entitlement checks, or API authorization.
- Changes to `@fxl-business/hub-sdk` or the sibling Hub SDK repository.
- Browser storage persistence, cross-tab cache synchronization, service workers, multi-replica coordination, retries, or proactive background refresh.
- UI changes, route-guard redesign, suppression of login after an unrecoverable session response, or changes to workspace selection UX.
- An assumed TTL for ordinary refresh responses that do not contain a valid JWT `exp`.
