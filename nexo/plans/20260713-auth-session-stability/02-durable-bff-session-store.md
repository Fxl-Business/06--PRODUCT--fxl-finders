---
id: 02-durable-bff-session-store
milestone: null
status: parked
depends_on: []
files_modified:
  - CLAUDE.md
  - apps/api/.env.dev.example
  - apps/api/.env.example
  - apps/api/drizzle/0009_durable_bff_sessions.sql
  - apps/api/drizzle/meta/0009_snapshot.json
  - apps/api/drizzle/meta/_journal.json
  - apps/api/src/db/__tests__/hub-session-migration-contract.test.ts
  - apps/api/src/db/schema.ts
  - apps/api/src/env.ts
  - apps/api/src/lib/__tests__/hub-session-crypto.test.ts
  - apps/api/src/lib/__tests__/hub-session-persistence.test.ts
  - apps/api/src/lib/__tests__/hub-session-request-coordinator.test.ts
  - apps/api/src/lib/__tests__/hub-session-store.test.ts
  - apps/api/src/lib/hub-session-crypto.ts
  - apps/api/src/lib/hub-session-persistence.ts
  - apps/api/src/lib/hub-session-request-coordinator.ts
  - apps/api/src/lib/hub-session-store.ts
  - apps/api/src/middleware/__tests__/app-auth-bff.test.ts
  - apps/api/src/middleware/app-auth.ts
  - apps/api/src/server.ts
acceptance: "Given concurrent refresh-token-consuming requests for one authenticated BFF session, when they rotate or delete the session and the single API process later restarts, then requests use the latest token serially, responses wait for durable persistence, and cleared sessions are not restored."
---

# Slice 02 - Durable BFF Session Store

## Goal

Keep Hub BFF sessions valid across a restart of the current single API instance, serialize refresh-token-consuming requests per opaque session, persist refresh-token rotation, and remove persisted server state when the SDK logs out or rejects a session as unrecoverable.

## Root Cause

`createHubBff` currently receives no `sessionStore`, so Hub SDK 1.2.0 creates its default `InMemoryHubSessionStore`.
The browser retains the opaque `fxl_hub_session` cookie across a Coolify restart, but the replacement API process has an empty map.
Its next `POST /auth/refresh` therefore returns `401 { error: "no_session" }` even though the prior login was valid.
The SDK also rotates the Hub refresh token by synchronously calling `sessionStore.update`, so persistence must preserve the newest value without changing the SDK contract.
The SDK reads the session record before each refresh, workspace switch, and logout call.
Without a request-level coordinator, overlapping routes for one cookie can read and send the same old refresh token upstream before either rotation is applied.

## Design

Add a `DurableHubSessionStore` that structurally implements the SDK's synchronous session-store interface.
The live process reads and writes a private in-memory map, while a per-session asynchronous persistence queue writes each session's changes to Postgres in call order.
The store exposes `hydrate()` for startup and `whenIdle(sessionId?)` as an observable durability barrier.
`whenIdle(sessionId)` snapshots operations already enqueued for that session, waits for all of them to settle, and rejects with a fixed, sanitized persistence error if any operation failed.
The no-argument form snapshots all queues and is reserved for callback creation because the SDK does not expose the newly generated session id to the wrapper.
Each session queue keeps a separately healed ordering tail so one rejected operation does not prevent a later operation for that session, while unrelated session queues remain independent.
Only BFF session records are durable.
The short-lived PKCE verifier and CSRF login transaction remain in memory and single-use.

Add a Drizzle persistence adapter backed by a new global `hub_sessions` table.
The adapter encrypts every Hub refresh token before an insert or update and decrypts rows during hydration.
Use AES-256-GCM with a random 12-byte IV, a 16-byte authentication tag, a versioned base64url envelope, and the opaque session id as additional authenticated data.
The database never receives a plaintext refresh token.

Make `createAppAuthBff` asynchronous and give it narrow optional injection seams for a `HubSessionPersistence` and `fetchImpl` so the real SDK routes can be exercised offline.
In production it constructs the Drizzle adapter, creates one durable store, awaits hydration, and then passes that exact store as `sessionStore` to `createHubBff`.
Wrap the real SDK router in one outer Hono router whose `/auth/*` middleware calls the SDK route first and then awaits `sessionStore.whenIdle()` before the request promise can resolve to the caller.
On a barrier failure, replace the SDK response with a sanitized `503` auth-unavailable response, clear the browser session cookie, and do not return a callback redirect, access token, logout `204`, or unrecoverable-session `401` as if durable state had succeeded.
Before the wrapper calls the real SDK for `/auth/refresh`, `/auth/switch`, or `/auth/logout`, read the opaque session cookie and enter a process-local coordinator keyed by that value.
Hold the per-session coordinator slot across both SDK route handling and `sessionStore.whenIdle()` so the next same-session route cannot read the store until the prior rotation or deletion is durable.
Use independent coordinator chains for different session ids, release in `finally`, and remove an entry when its last queued task settles.
The coordinator may hold the opaque id only as an in-memory map key and must never log, expose, hash for telemetry, or include it in errors.
`server.ts` must await `createAppAuthBff` before mounting the auth router and before calling `serve`.

This write-through plus boot hydration model is deliberately scoped to the current single-instance Coolify deployment.
The in-memory map is authoritative only for that process and is not a replica-coordination mechanism.

## Test Contract

The locked oracle command is:

```bash
pnpm --filter @fxl-sales/api test -- src/lib/__tests__/hub-session-store.test.ts src/lib/__tests__/hub-session-crypto.test.ts src/lib/__tests__/hub-session-persistence.test.ts src/lib/__tests__/hub-session-request-coordinator.test.ts src/middleware/__tests__/app-auth-bff.test.ts src/db/__tests__/hub-session-migration-contract.test.ts
```

The revision RED run must fail against the integrated implementation because it has no per-session route coordinator, overlapping refresh and switch calls can read the same stored token, and the callback assertion assumes `/` instead of the configured post-login redirect.
Do not weaken, delete, or replace these tests during Green.

### Exact RED cases

`apps/api/src/lib/__tests__/hub-session-store.test.ts` must lock these behaviors:

1. `create` returns a unique base64url session id with at least 128 bits of entropy and makes the record synchronously readable.
2. A first store creates a session and reaches `whenIdle`; a fresh second store using the same fake persistence starts empty, runs `hydrate`, and reads the original record by the same id.
3. A first store creates `rt-old`, reaches idle, updates the session to `rt-rotated`, and reaches idle; a fresh hydrated store restores only `rt-rotated`.
4. A first store deletes a persisted session and reaches idle; a fresh hydrated store returns `null`, proving cleared server state is not resurrected.
5. `create`, `update`, and `delete` for one session reach the persistence port in that exact order even when called synchronously.
6. A rejected persistence operation does not throw through the SDK's synchronous `create`, `update`, or `delete` call, but the next `whenIdle()` rejects with a fixed `HubSessionPersistenceError` that contains no cause text, operation name, session id, refresh token, ciphertext, key, or record data.
7. After `whenIdle()` observes a rejected operation, a later queued operation still executes in order and a later `whenIdle()` resolves when that operation succeeds, proving the ordering tail remains usable.
8. Hold a persistence operation for `session-1`, complete an operation for `session-2`, and assert `whenIdle("session-2")` resolves while `whenIdle("session-1")` remains pending.
9. Assert per-session pending-operation and ordering-tail entries are removed after their final success or observed failure.
10. Store-level persistence failures produce no direct console output, leaving the response wrapper as the single place for a fixed operational diagnostic.
11. `createLogin` and `consumeLogin` remain in-memory, single-use, and absent from persistence calls.

`apps/api/src/lib/__tests__/hub-session-crypto.test.ts` must lock these behaviors:

1. A valid 64-hex-character key encrypts and decrypts a refresh token round trip.
2. Ciphertext differs from and does not contain the plaintext refresh token.
3. Encrypting the same token twice yields different envelopes because each call uses a fresh IV.
4. Tampering with the envelope, changing the session id used as authenticated data, or supplying malformed ciphertext makes decryption throw.
5. A missing, short, or non-hex key is rejected with an error that names `FXL_HUB_SESSION_ENCRYPTION_KEY` and gives `openssl rand -hex 32` as the generation command.

`apps/api/src/lib/__tests__/hub-session-persistence.test.ts` must exercise `createDrizzleHubSessionPersistence` itself with a mocked `getDb()` and the real cipher:

1. Call `put("session-1", { hubRefreshToken: "rt-plaintext", accountId: "account-1" })`, capture the values passed to Drizzle `insert(...).values(...)`, and assert the adapter writes `encryptedRefreshToken` that differs from and does not contain `rt-plaintext`.
2. Decrypt the captured value with the real cipher and authenticated session id `session-1`, and assert it yields `rt-plaintext`, proving the production write is a valid authenticated envelope rather than an arbitrary transformed value.
3. Return one valid encrypted row from the mocked Drizzle select chain, call `loadAll`, and assert the adapter returns the original refresh token and account id for hydration.
4. Return one valid encrypted row beside one malformed or wrong-authentication-tag row, call `loadAll`, and assert the valid session is returned while only the corrupt row is skipped.
5. Spy on `console.warn` for the corrupt-row case and assert it emits only fixed diagnostic text, never the opaque session id, plaintext, ciphertext, encryption key, account id, or a decrypted record.
6. Call `remove("session-1")` and assert the production adapter issues a delete constrained by the opaque primary key.

`apps/api/src/lib/__tests__/hub-session-request-coordinator.test.ts` must lock the focused coordinator contract:

1. Construct `HubSessionRequestCoordinator`, start two `run("session-1", task)` calls, hold the first task pending, and assert the second task has not started.
2. Release the first task and assert the second starts only after the first promise settles, including when the first task rejects.
3. Hold a task for `session-1`, start a task for `session-2`, and assert the second session runs immediately and completes independently.
4. Assert `activeCount()` returns zero after the final queued task for a key succeeds and also after it rejects, proving map entries are removed in `finally`.
5. Run another task for a previously released key and assert it starts immediately, proving cleanup does not leave a stale resolved or rejected chain.
6. Spy on console output and coordinator errors and assert no session id appears on success, queued execution, task rejection, or cleanup.

`apps/api/src/middleware/__tests__/app-auth-bff.test.ts` must exercise the real Hub SDK router with fake discovery and Hub responses:

1. Seed fake persistence with `session-1` and `rt-old`, create the BFF, send `POST /auth/refresh` with the same opaque session cookie, and assert a 200 response plus an outbound Hub cookie containing `rt-old` rather than `no_session`.
2. Make Hub return `rt-rotated`, hold the adapter's update promise pending, start `POST /auth/refresh`, and assert the Hono request promise remains unresolved and no 200 access-token response is observable until the update is released.
3. Release the rotated-token update, await the 200 response, immediately construct a fresh BFF over the same persistence without `vi.waitFor`, refresh again, and assert the new process sends `rt-rotated` to Hub.
4. Complete a real `/auth/login` transaction to obtain its login cookie and state, make the callback token exchange return a refresh token, hold the persistence put pending, and assert the callback request remains unresolved and no success redirect or browser session cookie is observable until the put is released.
5. Release the callback put, await the success redirect, assert its `Location` equals the configured post-login redirect resolved by the test environment, currently `http://localhost:8006`, and never hardcode `/` as the expected location.
6. Immediately construct a fresh BFF over the same persistence and assert the callback's issued opaque session cookie restores the persisted refresh token.
7. Seed a session, hold persistence removal pending, call `POST /auth/logout`, and assert the request remains unresolved and no 204 acknowledgement is observable until removal is released.
8. Release logout removal, await the 204, immediately construct a fresh BFF, and assert the old cookie receives `401 no_session` without a polling wait.
9. Seed a session, make Hub return 401 from refresh, hold persistence removal pending, and assert the request remains unresolved and no unrecoverable-session 401 is observable until removal is released.
10. Release the refresh-401 removal, await the 401, immediately construct a fresh BFF, and assert the deleted session is not hydrated.
11. Parameterize callback put, rotated refresh update, logout removal, and refresh-401 removal rejection cases and assert each request resolves as sanitized `503 { error: "unavailable", code: "session_persistence_failed" }` rather than its SDK success or auth response.
12. In every rejection case, assert the browser session cookie is cleared, no access token or success redirect is returned, and captured console output contains only fixed diagnostic text without the session id, refresh token, ciphertext, encryption key, account id, database error text, or serialized record.
13. After a rejected request, make persistence recover, perform a later auth write, and assert its barrier can complete, proving failure observation does not poison the serialized queue.
14. Delay `loadAll` with a controllable promise and assert `createAppAuthBff` does not resolve until hydration completes, which locks the required boot ordering.
15. Start a refresh for `session-1`, hold its upstream Hub response, start a workspace switch for the same cookie, and assert the switch has not reached Hub and cannot read or send `rt-old` while refresh owns the coordinator slot.
16. Let refresh return `rt-after-refresh`, hold its persistence update pending, and assert the switch still has not reached Hub until the refresh response barrier becomes durable.
17. Release refresh persistence and assert the switch then sends `rt-after-refresh`, not `rt-old`, proving the coordinator covers both the SDK store read and the persistence barrier.
18. Repeat the refresh and switch overlap with switch arriving first, and assert the later refresh sends the token rotated by the switch rather than the original token.
19. Start two overlapping workspace switches for one cookie, hold the first upstream response and then its persistence update, and assert the second switch does not call Hub during either phase.
20. Release the first switch rotation, let the second rotate again, and assert persistence receives the two rotated tokens in request order and a freshly hydrated BFF restores only the second rotation.
21. Parameterize an in-flight refresh and an in-flight switch followed by same-session logout, hold each first request through its upstream phase and persistence barrier, and assert logout does not call Hub or delete the store until the first request fully completes.
22. After the first request completes, assert logout sends the latest rotated token to Hub, durably removes the session before 204, and a fresh BFF does not hydrate it.
23. Start same-session logout first, hold its durable removal, then start refresh and switch requests, and assert neither later request reaches Hub before logout completes and both observe `no_session` afterward.
24. Hold a refresh or switch for `session-1` first at Hub and then at its persistence update, start the same route for `session-2`, and assert the second request reaches Hub, durably persists its own rotation, and resolves without waiting for either phase of the first session.
25. After successful, failed, and mixed-session request matrices settle, assert the injected coordinator's `activeCount()` is zero and console output never includes either opaque session id.

`apps/api/src/db/__tests__/hub-session-migration-contract.test.ts` must read the generator-owned artifacts from disk and lock these behaviors:

1. Assert `apps/api/drizzle/0009_durable_bff_sessions.sql` creates exactly one `hub_sessions` table with `id text PRIMARY KEY`, `encrypted_refresh_token text NOT NULL`, nullable `account_id text`, and non-null timezone-aware `created_at` and `updated_at` defaults.
2. Assert the SQL contains no plaintext refresh-token seed, default, comment value, or column named `hub_refresh_token`.
3. Assert `apps/api/drizzle/meta/0009_snapshot.json` registers `public.hub_sessions` with the same columns, types, nullability, defaults, and primary key as the generated SQL.
4. Assert `apps/api/drizzle/meta/_journal.json` has one entry with `idx: 9`, `tag: "0009_durable_bff_sessions"`, and the current journal version, so the migrator will apply the SQL.

## Implementation Steps

1. Add all six test files declared in `files_modified` and run the locked oracle command once to capture RED.
2. Add `hubSessions` to `apps/api/src/db/schema.ts` with `id`, `encryptedRefreshToken`, nullable `accountId`, `createdAt`, and `updatedAt`.
3. Run `pnpm --filter @fxl-sales/api db:generate -- --name durable_bff_sessions` and retain the generated `0009_durable_bff_sessions.sql`, `0009_snapshot.json`, and journal entry only after inspecting the SQL.
4. Confirm the migration creates exactly one table named `hub_sessions`, with `id text PRIMARY KEY`, `encrypted_refresh_token text NOT NULL`, nullable `account_id text`, and non-null timezone-aware creation and update timestamps defaulting to `now()`.
5. Do not add `org_id`, RLS, or a secondary index because a BFF session is keyed by its opaque cookie id and can span active Hub workspaces.
6. Implement `createHubSessionCipher(rawKey)` in `hub-session-crypto.ts` with `encrypt(plaintext, sessionId)` and `decrypt(envelope, sessionId)` methods using Node's crypto library and the format locked by the crypto tests.
7. Implement the `HubSessionPersistence` port in `hub-session-store.ts` with `loadAll`, `put`, and `remove`, then implement the synchronous store methods, per-session serialized write queues, hydration, and observable idle barriers.
8. Track queued operation promises by session id until a targeted `whenIdle(sessionId)` snapshot observes them, use `Promise.allSettled` for that snapshot, remove only the observed promises, and throw one fixed `HubSessionPersistenceError` when any observed operation rejected.
9. Make no-argument `whenIdle()` snapshot all current per-session promises for callback creation, and do not use it for refresh, switch, or logout when the existing cookie id is known.
10. Maintain ordering with a separate tail per session that catches only to let that session's next operation run, retain settled results until a barrier observes them, and delete per-session pending and tail entries only when no queued or unobserved operation remains.
11. Implement `createDrizzleHubSessionPersistence(encryptionKey)` in `hub-session-persistence.ts` using `getDb()` from `src/db/client.ts`, the new schema table, and the cipher.
12. Keep the production adapter's database dependency mockable at the existing `getDb()` module boundary so its tests exercise the exported adapter without adding a second persistence implementation.
13. Make `put` encrypt before `insert(...).onConflictDoUpdate(...)`, update `updatedAt` on rotation, and preserve nullable `accountId`.
14. Make `loadAll` select only the required columns, decrypt with each row id as authenticated data, skip only rows that fail authenticated decryption, and return every valid session record for hydration.
15. Make corrupt-row logging and every write-failure diagnostic fixed strings that contain no row id, session id, account id, token, ciphertext, key, record, SQL parameter, or raw error text.
16. Make `remove` delete by the opaque primary key so both SDK logout and SDK refresh-401 paths clear Postgres through the store's existing `delete` method.
17. Implement `HubSessionRequestCoordinator` in its focused helper with `run<T>(sessionId, task): Promise<T>` and `activeCount(): number`.
18. Back the coordinator with a process-local map of per-session completion gates, await the prior gate before invoking a same-session task, release every gate in `finally`, and delete the map entry only when it still points to the completing tail.
19. Do not log, return, transform for telemetry, or attach the session id to a coordinator error.
20. Extend `createAppAuthBff` with optional persistence, fetch, and coordinator injection, construct production dependencies only when Hub auth is configured, await store hydration, and pass the store into `createHubBff`.
21. Create one outer Hono router in `app-auth.ts`, register `/auth/*` middleware before mounting the real SDK BFF, and recognize only `/auth/refresh`, `/auth/switch`, and `/auth/logout` as existing-session refresh-token consumers.
22. Read either the secure or non-secure Hub session cookie before `await next()`, enter the coordinator when a recognized route has a session id, and execute both real SDK handling and `sessionStore.whenIdle(sessionId)` inside the same coordinator task.
23. For callback, execute SDK handling plus no-argument `sessionStore.whenIdle()` as its response barrier because the generated session id is internal to the SDK.
24. For auth routes without an existing session cookie and without a possible persistence write, do not invent a shared lock key or a global barrier.
25. On a barrier rejection, replace the SDK response with `503 { error: "unavailable", code: "session_persistence_failed" }`, clear the configured secure or non-secure Hub session cookie, and emit only a fixed operational warning before the coordinator releases in `finally`.
26. Change `server.ts` to await BFF construction before route mounting and before `serve`, while preserving the current auth-not-configured behavior where no BFF is mounted and no database, coordinator, or encryption key is required.
27. Add optional `FXL_HUB_SESSION_ENCRYPTION_KEY` validation to `env.ts`, document a blank placeholder in both API env examples and `CLAUDE.md`, and require a valid value at BFF startup whenever Hub auth is configured.
28. Correct the callback oracle to compare `Location` with the configured `postLoginRedirect`, using `http://localhost:8006` under the repository test environment rather than assuming `/`.
29. Run the locked oracle command to Green, then run `pnpm --filter @fxl-sales/api lint` and `pnpm --filter @fxl-sales/api type-check` before handing the slice to the separate Verify agent.

## Migration and Data Rules

`hub_sessions` is a server infrastructure table, not a tenant business-data table.
It has no `org_id` because the opaque BFF session is tied to a Hub account session and may switch active workspaces.
All runtime queries use the primary key or load the complete active set once at boot, which is appropriate for the current single instance.
The generated Drizzle metadata and journal are generator-owned and must not be edited manually.
The container already runs the compiled migrator before `dist/server.js`, so the new table exists before hydration begins.

## Encryption and Secret Handling

`FXL_HUB_SESSION_ENCRYPTION_KEY` is a dedicated 32-byte key encoded as exactly 64 hexadecimal characters.
It must come from the deployment secret manager in staging and production and from an untracked local override in development.
Do not derive it from `FXL_HUB_SECRET_KEY`, commit a real value, place it in the browser, log it, or log refresh-token plaintext or ciphertext.
The example files contain only an empty placeholder and the generation command.
The same key must remain stable across restarts or existing rows cannot be decrypted.
Key rotation and bulk re-encryption are outside this slice.

## Failure Behavior

If Hub auth is configured but the database is unavailable, migration is missing, the encryption key is missing or invalid, or the initial `loadAll` query fails, startup must reject before the API listens.
This prevents a silently empty store from converting every retained browser cookie into `no_session`.
If one row is malformed or fails GCM authentication, skip only that row, emit fixed diagnostic text without any row or session identifier, and continue hydrating valid rows.
That browser will be required to sign in again while other sessions remain available.
If a post-start write fails, preserve the SDK's synchronous store method signatures but make the failure observable through `whenIdle()`.
The outer BFF wrapper must fail that auth request closed with a sanitized 503 before its SDK response is acknowledged, clear the browser session cookie, and emit only fixed diagnostic text.
The queue must still admit later operations after the rejected operation has been observed so a transient database failure does not permanently poison the process.
The per-session coordinator must release its gate and remove its final map entry after success, SDK failure, persistence failure, or thrown middleware work.
No failure path may leave the session id in logs, errors, response bodies, or a stale coordinator entry.

## Verification

The separate Verify agent must run the locked oracle command exactly as written, then the slice lint and type-check commands from the implementation steps.
At the wave boundary it must also run the repository's full root test, lint, and type-check commands required by Gate 2.

## Out of Scope

- Browser access-token caching and refresh coalescing belong to slice 01.
- Persisting access tokens, refresh tokens in browser storage, or PKCE login transactions is excluded.
- Multiple API replicas, Redis, pub-sub invalidation, sticky routing, distributed locks, and cross-instance live coherence are excluded.
- Changes to the sibling Hub SDK or reimplementation of its BFF routes are excluded.
- Session expiry, abandoned-row cleanup, encryption-key rotation, and bulk re-encryption are excluded.
- Applying the migration to staging or production, shipping a release, and changing Coolify topology are excluded.
