# Plan check: auth session stability

## Verdict

FAIL

The two-slice architecture addresses both reported paths: browser refresh races during creates and stale-tab recovery after a single API process restart.
The plans also have valid independent dependencies, canonical non-overlapping declarations, exact focused commands, browser JWT-expiry caching, concurrent refresh coalescing, workspace-switch seeding, logout clearing, startup hydration before listen, encrypted server persistence, generator-owned Drizzle artifacts, explicit single-instance scope, and no em dash characters.

## Actionable issues

1. Slice 01's locked oracle tests only the cache factory, not the required `react.tsx` wiring.
The focused command can pass if the executor never routes initial hydration through the cache, never calls `seed` after `setActive`, or never calls `clear` before logout.
Add a provider-level RED test that locks those three behaviors, include every added or changed test-support file in `files_modified`, and include that test in the exact focused command.

2. Slice 02's locked oracle bypasses `createDrizzleHubSessionPersistence` by injecting fake persistence, while the crypto oracle tests only the cipher in isolation.
The focused command can therefore pass if the production adapter writes plaintext, fails to decrypt on hydration, mishandles corrupt rows, or if the generated SQL, snapshot, and journal entry do not match the declared `hub_sessions` contract.
Add a RED adapter test proving ciphertext-only writes, authenticated decryption, and corrupt-row isolation, plus a migration contract test for the generated SQL and journal registration.
Declare the new canonical test paths and include them in the exact focused command.

3. Slice 01's security note says refresh tokens remain in the browser's HttpOnly BFF cookie.
The installed SDK stores only an opaque session id in that browser cookie, while the refresh token remains server-side.
Correct the sentence so the executor receives one unambiguous security model.

After these changes, re-run the plan checker before Gate 1.
