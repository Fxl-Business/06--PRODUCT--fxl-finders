# Gate 2 Retry 2 Verification - 02 Durable BFF Session Store

## Verdict

FAIL

Commit `9e9d26603aad1c672c9e1351029e8d6d25f3048b` passes the mandated commands and correctly serializes session-bound refresh, switch, and logout requests.
It does not satisfy the explicit no-global-bottleneck requirement because callback durability still waits on every session in the process.

## Blocking finding

### Callback persistence uses a process-wide barrier

The callback path calls `sessionStore.whenIdle()` without a session id at `apps/api/src/middleware/app-auth.ts:209`.
The no-argument implementation collects every key in `pendingWritesBySession` at `apps/api/src/lib/hub-session-store.ts:46` and awaits every collected write.

This couples a new user's callback response to unrelated sessions.
For example, if session A has a blocked refresh persistence write while callback B creates and successfully persists a new session, callback B still remains pending until session A settles.
If session A's unrelated write rejects, callback B returns the sanitized 503 even though callback B's own write committed.
That is a global response bottleneck and cross-session failure propagation.

The new different-session tests cover refresh and switch requests whose known cookie ids use `whenIdle(sessionId)`.
The callback test runs with no unrelated pending write, so it does not exercise this remaining global path.
A direct oracle should hold a write for session A, complete callback B's own write, and prove callback B settles independently and does not inherit session A's failure.

## Command evidence

- `pnpm --filter @fxl-sales/api test -- src/lib/__tests__/hub-session-store.test.ts src/lib/__tests__/hub-session-crypto.test.ts src/lib/__tests__/hub-session-persistence.test.ts src/lib/__tests__/hub-session-request-coordinator.test.ts src/middleware/__tests__/app-auth-bff.test.ts src/db/__tests__/hub-session-migration-contract.test.ts` exited 0.
  Vitest reported 24 files passed and 205 tests passed.
- `pnpm --filter @fxl-sales/api lint` exited 0 with no ESLint findings.
- `pnpm --filter @fxl-sales/api type-check` exited 0 with no TypeScript findings.

## Concurrency and durability review

- Serialization before SDK reads: PASS.
  Refresh, switch, and logout extract the opaque cookie id and enter the per-session coordinator before calling `next()`, so the SDK store read happens inside the lock.
- Persistence barrier inside the lock: PASS for session-bound routes.
  Each coordinated task awaits `sessionStore.whenIdle(sessionId)` before releasing the next task for that session.
- Refresh then switch: PASS.
  Switch does not reach the Hub until refresh rotation persistence completes and then reads the rotated token.
- Switch then refresh: PASS.
  Refresh does not reach the Hub until switch rotation persistence completes and then reads the switched token.
- Rotation request order: PASS.
  Overlapping same-session switches persist in request order, and a fresh BFF hydrates the final token.
- Rotation and logout ordering: PASS.
  Logout waits for preceding refresh or switch rotation and uses the latest token.
  Refresh and switch queued after logout observe the removed in-memory session only after durable deletion completes.
- Different-session parallelism: PARTIAL.
  Refresh and switch for different known session ids run independently at both the coordinator and persistence layers.
  Callback uses the global no-argument barrier and remains coupled to every pending session.
- Lock and queue cleanup: PASS.
  Coordinator gates are removed after success and failure.
  Per-session pending-write sets and ordering tails are removed after their final observed success or failure.
- No global bottleneck: FAIL.
  The callback path waits all pending session writes and inherits unrelated rejection state.

## Security and failure handling review

- Persistence failure observability: PASS for the operation being awaited.
  The store raises a fixed `HubSessionPersistenceError`, and the BFF returns a sanitized 503.
- Fail-closed response behavior: PASS.
  Success bodies and redirects are replaced, and the session cookie is expired on persistence rejection.
- Queue recovery after failure: PASS.
  Rejected operations do not poison later per-session ordering tails.
- No session-id logging: PASS.
  Neither the coordinator nor store logs its key.
  BFF and corrupt-row warnings are fixed messages without session ids.
- No other secret leakage: PASS.
  Refresh tokens, ciphertext, encryption keys, account ids, raw persistence errors, and session ids are absent from emitted logs and failure responses.

## Storage, boot, and integration review

- Authenticated encryption and key validation: PASS.
  AES-256-GCM uses a fresh IV, authentication tag, and session id as additional authenticated data.
  Environment and cipher validation require exactly 64 hexadecimal characters.
- Ciphertext-only database writes: PASS.
  The adapter encrypts the refresh token before Drizzle insert or conflict update, and the table has no plaintext token column.
- Corrupt-row isolation: PASS.
  Invalid ciphertext skips only its row and produces a fixed warning.
- Restart hydration: PASS for committed writes and deletions.
  The latest persisted token is restored, and committed deletions are not resurrected.
- Hydration-before-listen: PASS.
  BFF construction awaits hydration before the router is mounted and before `serve` runs.
- SDK store wiring: PASS.
  The durable store is passed through the Hub SDK `sessionStore` option.
- Configured callback redirect: PASS.
  The callback success response uses the configured `CORS_ORIGIN` fallback, verified as `http://localhost:8006`, rather than the SDK root default.
- Current scope: PASS.
  The design remains explicitly suitable for one API process and does not claim cross-instance cache coherence.

## Migration and diff review

- Schema, SQL migration, snapshot, and journal: PASS.
  Migration 0009, the Drizzle schema, snapshot 0009, and journal index 9 agree on the `hub_sessions` table contract.
  Snapshot 0009 points to the prior generated snapshot and otherwise differs by only `public.hub_sessions`.
- Test integrity: FAIL for the explicit no-global-bottleneck condition.
  The focused same-session and known different-session tests are strong, but no callback-versus-unrelated-session concurrency test reaches the remaining no-argument barrier.
- Unrelated changes: PASS.
  The base-to-HEAD diff is confined to durable Hub session storage, per-session coordination, configuration examples, migration artifacts, boot wiring, focused tests, and directly related documentation.
- Em dash check: PASS.
  No added line in the base-to-HEAD diff contains the em dash character.
- Diff hygiene: PASS.
  `git diff --check` reported no whitespace errors.
