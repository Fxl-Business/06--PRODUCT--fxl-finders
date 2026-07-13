# Gate 2 Verification - 02 Durable BFF Session Store

## Verdict

FAIL

The implementation passes its tests, lint, and type-check, but it does not guarantee that a completed refresh, logout, or Hub 401 is durable before the API can restart.
It also logs the opaque browser session identifier on persistence failure.

## Blocking findings

### 1. Session rotation and deletion are acknowledged before persistence completes

`DurableHubSessionStore.create`, `update`, and `delete` mutate the in-memory map and enqueue an asynchronous database operation at `apps/api/src/lib/hub-session-store.ts:42`, `apps/api/src/lib/hub-session-store.ts:55`, and `apps/api/src/lib/hub-session-store.ts:65`.
The SDK store interface is synchronous, so the Hub SDK returns the callback, refresh, logout, or 401 response immediately after calling those methods.
`createAppAuthBff` awaits initial hydration, but it returns the SDK router without awaiting `sessionStore.whenIdle()` after requests at `apps/api/src/middleware/app-auth.ts:168`.
The server also has no shutdown path that drains the write queue before process exit.

Consequently, a process restart after the client receives a successful rotated refresh response can hydrate the old refresh token from PostgreSQL.
A restart after logout or a Hub 401 can hydrate a session whose queued deletion had not completed.
This is ordered write-behind, not durable write-through at the request boundary, and it violates the stated restart acceptance criterion.

The BFF tests mask this window by receiving the HTTP response first and then using `vi.waitFor` until the fake persistence changes at `apps/api/src/middleware/__tests__/app-auth-bff.test.ts:118`, `apps/api/src/middleware/__tests__/app-auth-bff.test.ts:146`, and `apps/api/src/middleware/__tests__/app-auth-bff.test.ts:164`.
They do not restart at the response boundary while persistence is still pending.

### 2. Persistence failure logs an active session credential

The write failure handler logs `{ operation, sessionId }` at `apps/api/src/lib/hub-session-store.ts:92`.
The session id is the opaque value held in the browser authentication cookie, so it is credential material and should not be emitted to application logs.
The corresponding test checks only that refresh tokens are absent from logs and does not assert that the session id is absent.

The same failure handler swallows the database error and lets memory diverge from durable state.
That behavior makes `whenIdle()` resolve successfully even when the requested write or deletion failed, so callers cannot enforce or observe durability.

## Command evidence

- `pnpm --filter @fxl-sales/api test -- src/lib/__tests__/hub-session-store.test.ts src/lib/__tests__/hub-session-crypto.test.ts src/lib/__tests__/hub-session-persistence.test.ts src/middleware/__tests__/app-auth-bff.test.ts src/db/__tests__/hub-session-migration-contract.test.ts` exited 0.
  Vitest reported 23 files passed and 181 tests passed.
- `pnpm --filter @fxl-sales/api lint` exited 0 with no ESLint findings.
- `pnpm --filter @fxl-sales/api type-check` exited 0 with no TypeScript findings.

## Review checklist

- Authenticated encryption and key validation: PASS.
  AES-256-GCM uses a fresh 12-byte IV, a 16-byte authentication tag, and the session id as additional authenticated data.
  The key is restricted to exactly 64 hexadecimal characters.
- Ciphertext-only database writes: PASS.
  The schema and Drizzle write path persist only `encrypted_refresh_token`, optional `account_id`, and timestamps.
- Corrupt-row isolation: PASS with the logging caveat above.
  Individual decryption failures are skipped without exposing token, key, ciphertext, or account data.
- Ordered rotation and deletion: PARTIAL.
  The promise queue preserves invocation order, but completion is not coupled to the SDK response and failures are swallowed.
- Restart hydration and boot ordering: PASS for already committed rows.
  Hydration completes before the BFF router is mounted and before `serve` is called.
- SDK `sessionStore` wiring: PASS.
  The durable store is passed directly to the real Hub SDK BFF.
- Logout and Hub 401 deletion: PARTIAL.
  Both SDK paths invoke store deletion, but the durable deletion is not complete when the response is returned.
- Schema, migration, snapshot, and journal: PASS.
  Migration 0009, the Drizzle schema, snapshot 0009, and journal index 9 agree.
  Snapshot 0009 points to the prior generated snapshot and otherwise differs by only `public.hub_sessions`.
- Error handling and secret leakage: FAIL.
  Write errors are swallowed, durable divergence is not observable, and active session ids are logged.
- Current deployment scope: PASS as a documented design limit.
  The in-memory cache and process-local write queue support one API instance only and do not provide cross-instance coherence.
- Unrelated changes: PASS.
  The diff is limited to the durable Hub session implementation, its migration, configuration examples, tests, boot wiring, and directly related documentation.
- Em dash check: PASS.
  No added line in the base-to-HEAD diff contains the em dash character.
- Diff hygiene: PASS.
  `git diff --check` reported no whitespace errors.

## Test integrity assessment

The crypto, persistence, migration, hydration, SDK route, logout, and 401 tests are meaningful and exercise real code paths with focused fakes.
The critical missing oracle is a persistence promise held pending across the HTTP response followed by construction of a fresh BFF store.
That test would currently restore stale or deleted state and expose the acceptance failure.
