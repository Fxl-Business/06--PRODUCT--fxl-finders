# Run 20260713-0908-auth-session-stability

Mode: autopilot.
Flow: feature, upgraded from quick after root-cause investigation identified two independent failure paths.
Milestone: null.
Outcome: parked after delivering the browser token-cache slice and isolating the unresolved durable BFF session-store slice.
Effective baseline: `3ab7c503b0b4acc31f1f47051d9d740abd6bd93c`.
Effective master HEAD: `6bbc6dfb5cdd032e821c230f9cb1682a477adc15`.

## Frame

Authenticated users were unexpectedly sent through OAuth navigation during ordinary creates and after returning to a stale browser tab.
The investigation split the work into a browser token-lifecycle slice and a server session-durability slice so each failure path could be tested and delivered independently.

## Root cause

Hub SDK 1.2.0 performs `POST /auth/refresh` on every browser `getToken()` call and provides no access-token cache or single-flight coalescing.
Queries, mutations, and focus refetches therefore issued overlapping refreshes against the same rotating server-side session.
When one refresh returned `null`, the React adapter cleared the profile and `Protected` started OAuth login navigation, which appeared to the user as an automatic reload.
The API also uses the SDK default in-memory BFF session store, so an API restart forgets sessions while the browser retains its opaque session cookie.
The browser failure path is fixed on master, but the restart-durability path is not delivered.

## Planning and Gate 1

The first plan check failed because the browser oracle did not prove React provider wiring and the server oracle did not prove production encryption and generated migration contracts.
Revision 1 added provider-level cache wiring tests, production persistence adapter tests, migration artifact tests, and the correct opaque-cookie security model.
The revised plan check passed, and autopilot skipped only the human Gate 1 while retaining every machine gate.

## Red, Green, and Refactor evidence

### Slice 01 - Browser token cache

RED ran `pnpm --filter @fxl-sales/web test -- src/auth/__tests__/token.test.ts src/auth/__tests__/react.test.tsx` before implementation.
The first RED failed because `apps/web/src/auth/token.ts` did not exist and the provider still called the SDK client directly instead of the cache.
GREEN added a provider-scoped memory cache that coalesces concurrent misses, reuses JWTs only until `exp` minus 30 seconds, treats opaque normal refresh tokens as non-cacheable, and invalidates late refresh results through cache generations.
The provider now hydrates through the cache, seeds successful workspace tokens before applying their profile, and clears the cache and profile before awaiting SDK logout.
The initial GREEN command passed 41 tests across 9 files, and the web lint and type-check commands passed.
The first separate verification then exposed two missing lifecycle oracles: a late workspace-switch response could restore authentication after logout, and an older switch could replace a newer requested workspace.
The revised locked tests reproduced both races in RED.
The retry GREEN added a provider-local operation generation so logout invalidates earlier switches and only the newest requested switch may update cache and profile state.
The focused command then passed 43 tests across 9 files, including all 7 cache tests and 5 React provider tests, while web lint, web type-check, and `git diff --check` also passed.
The implementation commits were `bc4b25cbba9522c62a5189219316caa0be6fe62a` and `549f272d1d849cd68f1d17b137b067d5c438c2a9`.

### Slice 02 - Durable BFF session store

The parked server work added encrypted Postgres persistence, hydration, observable write barriers, and per-session refresh-token request coordination on `fix/durable-bff-session-store`.
Its bounded revisions addressed write acknowledgement before persistence, secret-safe failure handling, queue recovery, and same-session refresh, switch, and logout serialization.
The final verification still found that callback persistence calls the no-argument `whenIdle()` barrier, which waits on every pending session write and can make a new callback inherit an unrelated session failure.
Because this violates the no-global-bottleneck contract, the server slice was parked after its third bounded verification failure rather than delivered.

## Gate 2 attempts

1. Browser verification at `bc4b25c` failed because late and out-of-order workspace-switch responses were not rejected.
2. Browser retry verification at `549f272` passed the focused oracle, lint, type-check, diff hygiene, security review, and scope review.
3. Server verification at `76bcb9b` failed because refresh rotation and deletion could be acknowledged before persistence completed and persistence failures logged an opaque session id.
4. Server retry verification at `488a1be` passed after auth responses awaited durable writes and failures became observable and sanitized.
5. The first integrated wave verification at `b7777f3` failed because the full test gate was red and concurrent refresh-token-consuming server routes were not serialized before SDK reads.
6. Server retry verification at `9e9d266` confirmed session-bound serialization but failed because callback durability still used a process-wide persistence barrier.
7. Wave recovery reverted the server work, restored the browser-only tree, and passed the full machine gate at master HEAD `6bbc6df`.

## Final verification evidence

The separate browser-only wave verifier confirmed that the effective diff from `3ab7c50` to `6bbc6df` contains only seven browser-related paths and that the `apps/api` subtree exactly matches the baseline tree.
`CI=true pnpm test` exited 0 with 213 tests passing: 17 shared utility tests, 153 API tests, and 43 web tests.
`pnpm run lint` exited 0.
`pnpm run type-check` exited 0.
`pnpm run build` exited 0 after the API build and the Vite production web build completed.
`pnpm audit --prod --audit-level=high` exited 0 with no known vulnerabilities.
`git diff --check 3ab7c503b0b4acc31f1f47051d9d740abd6bd93c..HEAD` exited 0.
The mutation test removed the 30-second safety skew in a disposable worktree and ran `pnpm --filter @fxl-sales/web test -- src/auth/__tests__/token.test.ts`.
The mutated command exited 1 with 3 expected failures and 4 passes, proving the locked expiry tests detect removal of the safety boundary.

## Delivered files

- `apps/web/package.json`
- `apps/web/src/auth/__tests__/react.test.tsx`
- `apps/web/src/auth/__tests__/token.test.ts`
- `apps/web/src/auth/react.tsx`
- `apps/web/src/auth/token.ts`
- `apps/web/vitest.config.ts`
- `pnpm-lock.yaml`

The delivered browser access tokens remain memory-only and provider-local.
This slice does not provide cross-tab coordination.

## Parked work

The durable BFF session-store slice remains parked on `fix/durable-bff-session-store` at `9e9d26603aad1c672c9e1351029e8d6d25f3048b`.
All server files from that slice are absent from the effective master tree at `6bbc6df`.
No durable server session behavior is claimed or delivered by this run.

## Next action

Revise the SDK BFF integration contract so a callback can await only the session it creates instead of every session in the process.
Add a locked callback-versus-unrelated-session oracle that proves callback B settles after its own write while session A remains pending or fails.
Resume the parked branch only after that contract has a bounded implementation and a separate Gate 2 verifier can pass the focused oracle and full wave gate.
