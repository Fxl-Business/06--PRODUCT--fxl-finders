# Gate 2 Verification - 01-browser-token-cache

Verdict: **FAIL**

## Acceptance result

The cache implementation correctly coalesces concurrent misses, honors the 30-second JWT expiry skew, clears cached state on a current-generation null response, prevents stale cache-refresh responses from overwriting newer seeded or cleared state, and seeds workspace tokens before exposing their profile.

The slice does not guarantee that logout leaves no reusable browser token.

## Blocking finding

1. A workspace-switch response can restore authentication after logout has cleared it.

   In `apps/web/src/auth/react.tsx`, `setActive` awaits `client.setActive` and then unconditionally calls `tokenCache.seed` and `applyToken`.
   `logout` clears the cache and signed-in profile only when logout starts.
   If a user starts a workspace switch and then logs out before that switch resolves, the late switch response runs afterward, reseeds its access token, and restores a signed-in profile.
   The same missing operation ordering allows an older concurrent workspace-switch response to replace a newer switch result when responses arrive out of order.
   Because access tokens are bearer JWTs, the reseeded token can remain reusable even after the server-side logout completes.
   This violates the required invariant that cleared authentication leaves no reusable browser token and leaves stale workspace-response handling incomplete.

   Relevant implementation: `apps/web/src/auth/react.tsx:139` and `apps/web/src/auth/react.tsx:146`.
   The React oracle at `apps/web/src/auth/__tests__/react.test.tsx:196` verifies clear-before-SDK-logout ordering, but it does not exercise a workspace switch already in flight when logout begins or out-of-order concurrent workspace switches.

## Verification evidence

- `pnpm --filter @fxl-sales/web test -- src/auth/__tests__/token.test.ts src/auth/__tests__/react.test.tsx` exited 0 with 9 test files and 41 tests passing.
- `pnpm --filter @fxl-sales/web lint` exited 0 with no diagnostics.
- `pnpm --filter @fxl-sales/web type-check` exited 0 with no diagnostics.
- `git diff --check 3ab7c503b0b4acc31f1f47051d9d740abd6bd93c..HEAD` exited 0.

## Review notes

- Expiry and skew math is conservative at the boundary and uses the earlier valid JWT or server-provided expiry for seeded tokens.
- Invalid JWT expiry data is not granted an immortal cache lifetime.
- Refresh promise cleanup is identity-guarded, so an older promise cannot clear a newer in-flight promise.
- Current-generation null semantics discard cached state, while stale refresh results cannot overwrite a seed or clear.
- JWTs remain in memory only, and the parser handles malformed payloads without exposing secrets.
- The committed diff contains the seven related web auth, test configuration, dependency, and lockfile files expected for this slice.
- Changed content contains no em dash character.
- No unrelated committed file was found.

Passing commands do not override the blocking React lifecycle race above.
