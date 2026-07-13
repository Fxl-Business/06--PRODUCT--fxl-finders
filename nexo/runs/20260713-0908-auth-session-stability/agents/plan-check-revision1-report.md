# Plan check revision 1: auth session stability

## Verdict

PASS

The revised two-slice set fully addresses the create-triggered refresh race and stale-tab recovery after a restart of the current single API instance.

Slice 01 now locks the React provider wiring in addition to the cache factory.
Its exact focused command covers initial hydration through the cache, JWT-expiry reuse, concurrent refresh coalescing, authoritative workspace-switch seeding, null invalidation, and cache clearing before logout.
The added happy-dom dependency, Vitest discovery change, provider test, package manifest, and lockfile are all declared with canonical paths.

Slice 02 now locks the production Drizzle adapter with the real cipher and separately validates the generator-owned SQL, snapshot, and journal entry.
Its exact focused command proves encrypted writes, authenticated hydration, corrupt-row isolation, ordered durable rotation and deletion, real SDK refresh and logout behavior, and hydration completion before BFF construction resolves.
The planned `0009` artifacts correctly follow the current journal entry at index 8, and every required production, test, environment, documentation, schema, migration, and metadata path is declared.

Both slices have one testable Given/When/Then acceptance statement, valid empty dependencies, and non-overlapping file sets, so wave 1 is safe.
The plans keep access tokens browser-memory-only, keep refresh tokens encrypted server-side, preserve opaque browser cookies, exclude multi-replica coordination, and leave no material design decision to the executors.
No plan sentence contains an em dash character.
