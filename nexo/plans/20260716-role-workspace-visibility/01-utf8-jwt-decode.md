---
id: 01-utf8-jwt-decode
milestone: v2.2.0
status: done
depends_on: []
files_modified:
  - apps/web/src/auth/claims.ts
  - apps/web/src/auth/token.ts
  - apps/web/src/auth/__tests__/claims.test.ts
  - apps/web/src/auth/__tests__/token.test.ts
acceptance: "given a Hub JWT whose claims contain a non-ASCII name, when parseJwtPayload decodes it, then the name is returned as correct UTF-8 (e.g. 'Gestão FXL'), not Latin-1 mojibake"
---

# 01 UTF-8 JWT decode

## Context

The account switcher renders the workspace/user name "Gestão FXL" as "GestÃ£o FXL" (mojibake).
Root cause: `parseJwtPayload` in `apps/web/src/auth/claims.ts` base64-decodes the JWT payload with `atob`, which returns a Latin-1 "binary string".
JWT payloads are UTF-8 JSON, so a multibyte char such as `ã` (UTF-8 bytes `C3 A3`) is read as two Latin-1 chars `Ã£`.
The corrupted value reaches the UI through `profileFromToken` in `apps/web/src/auth/react.tsx`, which reads `claims.name` and `claims.workspaceName`.
`readJwtExpiry` in `apps/web/src/auth/token.ts` has the same `atob` decode inline, but it only reads the numeric `exp`, so it never surfaces mojibake today (latent duplicate).

The fix is to decode the base64 to raw bytes and interpret those bytes as UTF-8 before `JSON.parse`, and to remove the duplicated decode by having `readJwtExpiry` reuse `parseJwtPayload`.

## Oracle Tests

The verifier will run both commands and both must pass.

- `pnpm --filter @fxl-sales/web test src/auth/__tests__/claims.test.ts`
- `pnpm --filter @fxl-sales/web test src/auth/__tests__/token.test.ts`

The web package `test` script is `vitest run`, so each command runs `vitest run <path>` against that single file.

## Plan

Follow TDD.
Write the failing UTF-8 test FIRST, watch it go RED, then apply the minimal fix to reach GREEN, then do the token.ts refactor guarded by an existing/added token test.

### 1. RED: add the failing UTF-8 test in claims.test.ts

Edit `apps/web/src/auth/__tests__/claims.test.ts`.
Inside the existing `describe('parseJwtPayload', ...)` block, after the current "decodes a base64url JWT payload" test, add a new test.
`Buffer.from(string)` defaults to UTF-8 encoding, which is exactly how a real Hub token encodes its payload bytes, so the builder below reproduces the real-world byte layout.

```ts
it('decodes multibyte UTF-8 claims as correct UTF-8, not Latin-1 mojibake', () => {
  const payload = Buffer.from(
    JSON.stringify({ name: 'Gestão FXL', workspaceName: 'Café ☕' }),
  ).toString('base64url');

  expect(parseJwtPayload(`header.${payload}.signature`)).toMatchObject({
    name: 'Gestão FXL',
    workspaceName: 'Café ☕',
  });
});
```

Run `pnpm --filter @fxl-sales/web test src/auth/__tests__/claims.test.ts` and confirm it FAILS.
With the current `atob`-only implementation the returned `name` is the mojibake `GestÃ£o FXL`, so the assertion fails as expected.

### 2. GREEN: fix the decode in claims.ts

Edit `apps/web/src/auth/claims.ts`.
Replace line 48 (`return JSON.parse(atob(padded)) as Record<string, unknown>;`) with a UTF-8-safe decode.
Keep the surrounding try/catch, the base64url-to-base64 replace, and the padding logic unchanged, and keep the return type `Record<string, unknown> | null`.

The body of `parseJwtPayload` becomes:

```ts
export function parseJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split('.');
  if (!payload) {
    return null;
  }

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
```

`atob(padded)` yields a Latin-1 string of raw bytes.
`Uint8Array.from(..., (char) => char.charCodeAt(0))` recovers the exact byte sequence.
`new TextDecoder().decode(bytes)` interprets those bytes as UTF-8, producing the original string.

Run `pnpm --filter @fxl-sales/web test src/auth/__tests__/claims.test.ts` and confirm ALL tests pass, including the new one and the pre-existing ASCII-only test.

### 3. REFACTOR: DRY the duplicate decode in token.ts

Edit `apps/web/src/auth/token.ts`.
Add an import of `parseJwtPayload` from the sibling module at the top of the file, alongside the existing import.

```ts
import { parseJwtPayload } from './claims';
```

Replace the current `readJwtExpiry` (lines 11-25, which contains the duplicated inline `atob` decode) with a version that reuses `parseJwtPayload`.

```ts
function readJwtExpiry(accessToken: string): number | null {
  const claims = parseJwtPayload(accessToken);
  if (!claims) return null;
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) return null;
  const expiresAt = claims.exp * 1_000;
  return Number.isFinite(expiresAt) ? expiresAt : null;
}
```

`parseJwtPayload` already handles the split, the missing-payload case, the base64url-to-base64 conversion, the padding, and the null-on-failure contract, so this preserves all existing behaviour of `readJwtExpiry` while removing the duplicated decode.
Do not change any other function in token.ts.

### 4. Guard the refactor with a token test

Edit `apps/web/src/auth/__tests__/token.test.ts`.
The existing `jwtWithExpiry(expiresAtMs, claims)` builder already accepts extra claims and encodes with `Buffer.from(...).toString('base64url')` (UTF-8), so it can carry a multibyte name.
Add a test inside `describe('createHubAccessTokenCache', ...)` proving the cache still reads `exp` and serves a JWT whose payload contains multibyte display claims.

```ts
it('reads JWT expiry from a token carrying multibyte display claims', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_MS);
  const token = jwtWithExpiry(NOW_MS + 120_000, { name: 'Gestão FXL' });
  const getToken = vi.fn<HubClient['getToken']>().mockResolvedValue(token);
  const cache = createHubAccessTokenCache(fakeClient(getToken));

  await expect(cache.getToken()).resolves.toBe(token);
  vi.setSystemTime(NOW_MS + 120_000 - ACCESS_TOKEN_EXPIRY_SKEW_MS - 1);
  await expect(cache.getToken()).resolves.toBe(token);
  expect(getToken).toHaveBeenCalledTimes(1);
});
```

Run `pnpm --filter @fxl-sales/web test src/auth/__tests__/token.test.ts` and confirm ALL tests pass.

### 5. Final verification

Run both oracle commands and confirm both are green.

- `pnpm --filter @fxl-sales/web test src/auth/__tests__/claims.test.ts`
- `pnpm --filter @fxl-sales/web test src/auth/__tests__/token.test.ts`

## Notes

Null and invalid tokens are unaffected.
A missing payload segment still returns `null` via the early `if (!payload) return null;` guard.
Malformed base64 or non-JSON payloads still throw inside the try and return `null` via the existing catch, because the new byte and TextDecoder steps run inside the same try/catch.

ASCII-only claims are unchanged.
For single-byte ASCII, `char.charCodeAt(0)` equals the byte value and UTF-8 decoding is identical to Latin-1, so the pre-existing `sub` and `workspaceId` test keeps passing.

No import cycle results.
`claims.ts` imports nothing from `token.ts` (it imports nothing at all today), and `token.ts` importing `parseJwtPayload` from `claims.ts` is a one-directional edge, so there is no cycle.
`react.tsx` already imports from both modules and is unaffected.

Runtime globals are available in every target environment.
`atob`, `Uint8Array`, and `TextDecoder` are all globals in the browser and in the Vite build.
The vitest config (`apps/web/vitest.config.ts`) uses `environment: 'node'`, and all three are Node globals as well, so no polyfill or import is needed.

Keep the change confined to the four files in `files_modified`.
Do not touch `react.tsx`; once `parseJwtPayload` returns correct UTF-8, `profileFromToken` and the account switcher render the correct name with no further change.

Style: no em dashes, and one full sentence per line in this markdown.
