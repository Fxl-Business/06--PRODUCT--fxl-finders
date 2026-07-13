# Gate 2 Retry 1 Verification - 02 Durable BFF Session Store

## Verdict

PASS

Commit `488a1becd1bd8856bb27085c9218b01f8ae227d0` satisfies the durable single-process Hub BFF session acceptance criterion over the inspected range `3ab7c503b0b4acc31f1f47051d9d740abd6bd93c..HEAD`.
No blocking or non-blocking code review findings remain.

## Command evidence

- `pnpm --filter @fxl-sales/api test -- src/lib/__tests__/hub-session-store.test.ts src/lib/__tests__/hub-session-crypto.test.ts src/lib/__tests__/hub-session-persistence.test.ts src/middleware/__tests__/app-auth-bff.test.ts src/db/__tests__/hub-session-migration-contract.test.ts` exited 0.
  Vitest reported 23 files passed and 189 tests passed.
- `pnpm --filter @fxl-sales/api lint` exited 0 with no ESLint findings.
- `pnpm --filter @fxl-sales/api type-check` exited 0 with no TypeScript findings.

## Durability and fail-closed proof

- Callback create: PASS.
  The real SDK callback route creates the server session, and the wrapper response remains pending across an event-loop turn while the controlled persistence write is unresolved.
  After release, the callback returns 302 with the persisted opaque session id, and a fresh BFF instance hydrates and refreshes with the callback token.
- Rotated refresh update: PASS.
  A rotated refresh response remains pending until the queued update commits.
  A fresh BFF instance then hydrates the rotated token rather than the prior token.
- Logout delete: PASS.
  The 204 acknowledgement remains pending until deletion commits.
  A fresh BFF instance does not restore the removed session.
- Hub 401 delete: PASS.
  The 401 response remains pending until deletion commits.
  A fresh BFF instance rejects the old cookie as `no_session`.
- Persistence rejection: PASS.
  Callback create, rotated refresh, logout delete, and Hub 401 delete rejection cases all return a sanitized 503 instead of their success or authentication response.
  Redirect and prior cookie headers are removed, and the browser session cookie is expired.
- Queue recovery: PASS.
  `whenIdle()` exposes a fixed `HubSessionPersistenceError` without the original error or cause.
  The ordering tail consumes the rejected operation only for sequencing, later writes still execute, and the next barrier can complete successfully.

## Security and adapter review

- Authenticated encryption: PASS.
  AES-256-GCM uses a fresh 12-byte IV, a 16-byte authentication tag, and the session id as additional authenticated data.
  Tampering, malformed envelopes, and decrypting under another session id fail authentication.
- Key validation: PASS.
  Both environment parsing and cipher construction require exactly 64 hexadecimal characters, representing a 32-byte key.
- Ciphertext-only database writes: PASS.
  The Drizzle adapter encrypts before constructing insert and conflict-update values.
  The database schema has no plaintext refresh-token column, seed, default, or comment.
- Corrupt-row isolation: PASS.
  A corrupt row is skipped independently while valid rows still hydrate.
  The warning is a fixed message with no row id or secret material.
- Secret leakage: PASS.
  Store failures produce no direct console output.
  The BFF wrapper logs only `Hub session persistence failed` and returns a fixed response body.
  Tests inject session ids, refresh tokens, ciphertext markers, key markers, account ids, and raw database error text, then assert none appears in logs, response bodies, or response cookies.
- Error observability: PASS.
  Persistence failure is observable at both the store barrier and the HTTP boundary without exposing the underlying error.

## Hydration, wiring, and scope review

- Restart hydration: PASS.
  Persisted sessions preserve their opaque ids and latest refresh tokens, while committed deletions are absent from a fresh store.
- Hydration-before-listen ordering: PASS.
  `createAppAuthBff()` awaits `sessionStore.hydrate()` before returning the router.
  `server.ts` awaits BFF creation before mounting the router and before calling `serve`.
- SDK session store wiring: PASS.
  The durable store is supplied directly through the Hub SDK `sessionStore` option.
- Ordered write-through behavior: PASS.
  Create, update, and delete writes share one process-local ordering tail.
  The `/auth/*` middleware awaits the observed persistence operations before allowing the SDK response to settle.
- Deployment scope: PASS.
  The implementation is correct for the explicitly accepted single API process.
  Its in-memory cache and process-local queue do not claim cross-instance coherence.

## Migration and diff review

- Schema, SQL migration, snapshot, and journal: PASS.
  Migration 0009, the Drizzle schema, snapshot 0009, and journal index 9 agree on the `hub_sessions` table contract.
  Snapshot 0009 points to the prior generated snapshot and otherwise differs by only `public.hub_sessions`.
- Test integrity: PASS.
  Deferred persistence controls prove the HTTP pending boundary directly instead of waiting for eventual state after receiving a response.
  The tests use the real Hub SDK BFF routes with an injected Hub fetch and persistence port.
- Unrelated changes: PASS.
  The base-to-HEAD diff is confined to durable Hub session storage, configuration examples, migration artifacts, boot wiring, focused tests, and directly related documentation.
- Em dash check: PASS.
  No added line in the base-to-HEAD diff contains the em dash character.
- Diff hygiene: PASS.
  `git diff --check` reported no whitespace errors.
