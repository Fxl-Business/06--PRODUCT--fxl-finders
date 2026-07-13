# Wave Verify Report: auth-session-stability-wave-1

Verdict: **FAIL**

Verified commit: `b7777f34d60343ad93e7bbc66363543354799928` on `master`.

Reviewed range: `3ab7c503b0b4acc31f1f47051d9d740abd6bd93c..HEAD`.

## Blocking findings

### 1. Full test gate is red

`CI=true pnpm test` exited 1.

The API suite had 1 failed test out of 189: `createAppAuthBff durable session wiring > holds callback success until create persistence is durable` expected the callback location `/`, but the loaded repository environment produced `http://localhost:8006`.

The web suite also reported an unhandled `ERR_MODULE_NOT_FOUND` for the newly declared `happy-dom` dependency, so the new TSX auth-provider test file did not run.

The package manifest and lockfile declare `happy-dom@20.10.6`, but the installed dependency tree is stale relative to them.

Gate 2 cannot pass while the mandated full-suite command exits nonzero.

### 2. Refresh and workspace-switch rotation is not serialized across the two slices

The browser cache coalesces concurrent `getToken()` calls, but `HubAuthProvider.setActive()` calls `client.setActive()` independently of an already in-flight token refresh and permits multiple workspace switches to reach the BFF concurrently.

The generation checks in `apps/web/src/auth/react.tsx` prevent a late response from updating browser state, but they do not cancel or serialize the underlying Hub requests.

The BFF reads the same refresh-token record before each upstream call, while `DurableHubSessionStore` serializes only the later persistence writes in response-completion order.

With rotating Hub refresh tokens, overlapping refresh and switch requests can therefore send the same old token concurrently.

One request can receive 401 and delete the session after the other succeeds, or out-of-order successful responses can persist an older rotation after a newer one.

This means the integrated implementation does not guarantee that the current session retains the latest rotated refresh token or survives restart after these cross-slice races.

The new browser test for out-of-order workspace switches verifies only the displayed profile and explicitly allows concurrent SDK calls, so it does not cover this server-session failure mode.

## Acceptance review

- Concurrent creates and focus refetches share one in-memory cache and one in-flight `getToken()` promise.
- Cached access tokens are kept only in closure memory and are considered stale at JWT expiry minus 30 seconds.
- Cache generations prevent late token-refresh results from restoring state after `clear()` and make a seeded workspace token authoritative in browser memory.
- Provider operation generations prevent late workspace responses from restoring browser state after logout and ignore older workspace responses.
- AES-256-GCM encrypts refresh tokens at rest with a random 96-bit IV, a 128-bit authentication tag, and session id as authenticated additional data.
- BFF session hydration completes before `createAppAuthBff()` resolves, and `server.ts` awaits that before calling `serve()`.
- The production Docker command runs `dist/db/migrate.js` before `dist/server.js`.
- The generated `0009` snapshot chains to `0007` and, after metadata ids are removed, differs only by `public.hub_sessions`.
- Callback, refresh, logout, and refresh-401 handlers pass through a persistence barrier before their response resolves in the implemented design.
- Persistence failures are converted to a fixed 503 body, redirect and successful session cookie headers are removed, a deletion cookie is emitted, and underlying credential-bearing error text is not logged or returned.
- The missing cross-request rotation serialization prevents the cumulative implementation from satisfying the latest-token durability acceptance criterion.

## Fresh gate evidence

| Check | Result | Evidence |
| --- | --- | --- |
| `CI=true pnpm test` | FAIL | Exit 1; API 1/189 failed; web had one unhandled missing-package error and did not execute the TSX auth test file. |
| `pnpm run lint` | PASS | Exit 0 for API, web, and workspace packages. |
| `pnpm run type-check` | PASS | Exit 0 for API, web, and workspace packages. |
| `pnpm run build` | PASS | Exit 0; API TypeScript build and web Vite production build completed. |
| `pnpm audit --prod --audit-level=high` | PASS | Exit 0; `No known vulnerabilities found`. |
| `git diff --check 3ab7c503b0b4acc31f1f47051d9d740abd6bd93c..HEAD` | PASS | Exit 0. |
| Added-line secret scan | PASS | No private key, live-token, GitHub-token, AWS-key, populated Hub secret, or populated 64-hex encryption-key pattern found. |
| Added-line em dash scan | PASS | No U+2014 character found in added lines. |
| Generated migration review | PASS | SQL, journal entry, schema, snapshot chain, and Docker migration-before-server order agree. |

## Conclusion

The integrated wave is **FAIL** because the mandatory full suite is red and cross-slice request concurrency can lose or stale the rotated durable Hub session even though late browser state updates are ignored.
