# Browser Token Cache Wave Recovery Verification

- Agent: `verify`
- Slice: `browser-token-cache-wave-recovery`
- Baseline: `3ab7c503b0b4acc31f1f47051d9d740abd6bd93c`
- Verified HEAD: `6bbc6dfb5cdd032e821c230f9cb1682a477adc15`
- Branch: `master`
- Verdict: `PASS`
- Started: `2026-07-13T13:30:00Z`
- Completed: `2026-07-13T13:33:35Z`

## Scope and tree integrity

The effective baseline-to-HEAD diff contains seven paths, all under `apps/web` except the workspace lockfile.
The source changes are limited to the browser auth provider, the new in-memory token cache, its unit and React tests, the web test configuration, and the `happy-dom` test dependency.
The `HEAD` tree hash is exactly equal to the intended recovered browser branch tree at `549f272` (`b065b63395a3bcb29e6285b4d3a8714dd2774fd4`).
The `apps/api` subtree hash is exactly equal at the baseline and HEAD (`f66655203bf33b2ef145daba4390b00a2e86c071`).
There is no effective API diff, so the durable BFF session-store slice and its follow-up write-await change are fully reverted.
No unrelated functional change was found.
The generated lockfile update includes incidental pnpm normalization that removes `libc` annotations from existing Rollup optional-package records, but it does not change source behavior and all install-derived verification, build, and audit gates pass with the repository-pinned pnpm version.

## Acceptance verification

| Acceptance criterion | Evidence | Result |
| --- | --- | --- |
| Concurrent creates and focus refetches share one SDK refresh | Every query and mutation obtains the stable provider `getToken` callback, which delegates to one provider-scoped cache. On a miss, `inFlight` is installed synchronously before returning, and all concurrent callers receive that promise. The real-cache test invokes three concurrent callers and proves one SDK call. | PASS |
| Fresh JWTs are reused only until expiry minus safety skew | JWT `exp` is decoded in memory, cached tokens require `Date.now() < expiresAt - 30_000`, and the boundary test proves reuse one millisecond before the boundary and refresh at the boundary. Invalid or opaque normal refresh results are not retained. | PASS |
| Null clears auth | An authoritative SDK `null` discards cached token and expiry. Provider hydration and public `getToken` both apply the cache result to the auth profile, so `null` produces the signed-out state. The cache test proves the next call refreshes rather than reusing prior state. | PASS |
| Workspace tokens supersede refresh state | `seed` increments the cache generation, detaches the prior in-flight promise, installs the workspace token using the earlier JWT or server expiry, and makes a stale refresh resolve to the newly seeded fresh value. Tests cover both a stale token and stale `null`. | PASS |
| Logout cannot be undone by a late switch | Logout increments the provider operation generation, clears the cache, and applies signed-out state before awaiting the SDK. A late switch response fails its generation check and cannot seed or apply its token. The React test holds both promises and proves the profile stays signed out. | PASS |
| Out-of-order switches leave the newest requested switch authoritative | Each switch reserves a monotonically increasing provider operation generation before awaiting the SDK. Only the response whose generation is still current may seed and apply. The React test resolves the second request first, then the first request, and proves only the second workspace becomes visible. | PASS |

## Test integrity and lifecycle review

The cache tests exercise the real implementation rather than a mocked copy.
The React tests mock only the SDK and cache boundaries so they can verify provider ordering, wiring, and stale-response rejection.
No focused, skipped, todo, or weakened assertions were added.
The new `.tsx` test glob is active, and the full run executed all five new React tests and all seven cache tests.
The token cache and SDK client are memoized for the lifetime of one provider instance, so ordinary rerenders do not reset cached or in-flight state.
The hydration effect shares the same cache as consumers and uses an active flag to prevent profile updates after effect cleanup or unmount.
React development effect replay is safe because repeated hydration calls share the same in-flight refresh within the stable provider instance.
Workspace switch and logout ordering is guarded separately from cache refresh ordering, preventing UI auth state from being restored by stale switch completions.

## Security and browser-only scope

Access tokens are held only in closure variables owned by the mounted provider cache.
No token is written to local storage, session storage, IndexedDB, cookies, logs, source configuration, or another persistence mechanism by this change.
JWT parsing is used only to shorten cache retention and cannot extend retention beyond a valid server-provided lifetime for seeded tokens.
Invalid expiry metadata is rejected rather than converted into an immortal cache lifetime.
No added source line contains a credential or secret pattern.
The only key-like test value is an explicitly fake publishable test key.
No added line contains an em dash.
The production dependency audit found no known vulnerability at high severity or above.

The cache is intentionally scoped to one browser tab and one provider instance.
Separate tabs do not coalesce refreshes or propagate logout and workspace cache invalidation through this cache.
That limitation matches the accepted browser-only recovery scope because the durable server-side and cross-tab coordination slice is deliberately absent.

## Fresh command evidence

Environment: Node `v22.22.3`, pnpm `10.17.1`.

| Command | Outcome |
| --- | --- |
| `CI=true pnpm test` | Exit 0. Shared utils 17 tests, API 153 tests, and web 43 tests passed. Total: 213 tests, 0 failures. The tracked legacy-auth guard also passed. |
| `pnpm run lint` | Exit 0. API and web ESLint completed without errors. |
| `pnpm run type-check` | Exit 0. Shared packages, API, and web TypeScript checks completed. |
| `pnpm run build` | Exit 0. Shared packages and API compiled, and the Vite production web build completed with 1,807 modules transformed. |
| `pnpm audit --prod --audit-level=high` | Exit 0. `No known vulnerabilities found`. |
| `git diff --check 3ab7c503b0b4acc31f1f47051d9d740abd6bd93c..HEAD` | Exit 0 with no output. |

## Repository state

The verification commands created no tracked or staged changes.
Pre-existing untracked workspace content remains under `.vscode/`, `nexo/knowledge/doubts/`, `nexo/plans/`, and this run directory.
No persistent process was started.

## Verdict

PASS.
The recovered integrated wave satisfies every stated browser-token-cache acceptance criterion, contains no effective durable-session server change, and passes the full local Nexo wave gate.
