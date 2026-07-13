# Gate 2 Retry Verification - 01-browser-token-cache

Verdict: **PASS**

## Acceptance result

The updated slice satisfies the browser token-cache acceptance criteria.

One SDK refresh serves concurrent uncached callers, fresh JWTs remain reusable only outside the 30-second expiry safety skew, a workspace-switch token supersedes older refresh state, a current-generation null response clears cached authentication, and logout clears browser token state before the SDK logout request.

The retry also closes both previously blocking React lifecycle races.

## Locked race proof

1. Logout remains authoritative over an older workspace switch.

   `HubAuthProvider.logout` increments `operationGeneration` before clearing the token cache and applying the signed-out profile.
   Every workspace switch captures its own generation before awaiting the SDK.
   A switch that resolves after logout sees a generation mismatch and returns before `tokenCache.seed` or `applyToken`.
   The locked test defers both operations, starts the switch first, starts logout second, resolves the switch late, and asserts that the cache was not seeded, the Beta profile was never exposed, and the provider remains signed out.

2. The newest requested concurrent switch remains authoritative.

   Each `setActive` request increments and captures `operationGeneration` before awaiting its response.
   A later request therefore invalidates every earlier request regardless of response order.
   The locked test starts Beta and then Gamma, resolves Gamma first and Beta last, and asserts that only Gamma seeds the cache, Beta is never exposed, and the final profile remains Gamma.

Relevant implementation: `apps/web/src/auth/react.tsx:114`, `apps/web/src/auth/react.tsx:139`, and `apps/web/src/auth/react.tsx:147`.
Relevant locked tests: `apps/web/src/auth/__tests__/react.test.tsx:224` and `apps/web/src/auth/__tests__/react.test.tsx:269`.

## Verification evidence

- `pnpm --filter @fxl-sales/web test -- src/auth/__tests__/token.test.ts src/auth/__tests__/react.test.tsx` exited 0 with 9 test files and 43 tests passing, including 7 token-cache tests and 5 React auth tests.
- `pnpm --filter @fxl-sales/web lint` exited 0 with no diagnostics.
- `pnpm --filter @fxl-sales/web type-check` exited 0 with no diagnostics.
- `git diff --check 3ab7c503b0b4acc31f1f47051d9d740abd6bd93c..HEAD` exited 0.
- Verified HEAD is retry commit `549f272d1d849cd68f1d17b137b067d5c438c2a9`.

## Cache, security, and scope review

- JWT expiry parsing rejects malformed or non-finite expiry data without granting an immortal lifetime.
- Cached refresh tokens use JWT expiry, while seeded workspace tokens use the earlier valid JWT or server-provided expiry.
- The strict skew boundary refreshes rather than reusing a token at the boundary.
- Promise identity cleanup prevents an older refresh from clearing a newer in-flight promise.
- Cache generation checks prevent late refresh results, including null, from overwriting newer seed or clear state.
- Current-generation null responses discard cached token and expiry state.
- Logout clears cache and profile synchronously before awaiting the server logout.
- Bearer tokens remain memory-only, malformed token parsing is handled defensively, and no secret material was added.
- The cumulative diff contains only seven related auth implementation, auth test, test configuration, dependency, and lockfile files.
- Changed content contains no em dash character.
- No unrelated committed file or scope expansion was found.

No blocking correctness, test-integrity, lifecycle, security, or scope finding remains.
