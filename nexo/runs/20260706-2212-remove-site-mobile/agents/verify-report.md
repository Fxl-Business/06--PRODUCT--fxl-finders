# Gate 2 Verification Report

Slice: `01-remove-retired-surfaces`
Started: `2026-07-06T23:05:51-03:00`
Ended: `2026-07-06T23:06:59-03:00`
Overall status: FAIL

## Commands

| Command | Exit code | Result | Notes |
|---|---:|---|---|
| `test ! -d apps/site && test ! -d apps/mobile` | 0 | PASS | `apps/site` and `apps/mobile` are absent. |
| `rg -n "apps/(site\|mobile)\|@fxl-sales/site\|fxl-sales-mobile\|\\b[Ee]xpo\\b\|expo-router\|expo-\|EAS\|React Native\|NativeWind\|Next\\.js\|SITE_URL\|VITE_SITE_URL\|SITE_PORT\|localhost:4006\|@vercel/analytics\|next-env\|next\\.config" README.md CLAUDE.md Makefile scripts/setup.sh pnpm-workspace.yaml package.json apps packages -g '!node_modules/**' -g '!dist/**' -g '!build/**'` | 1 | PASS | No matches were returned, and exit code 1 is the expected pass condition for this retired-reference scan. |
| `pnpm --filter @fxl-sales/api test -- src/domains/referrals/__tests__/ua-family.test.ts src/domains/referrals/__tests__/click-handler.test.ts` | 0 | PASS | Vitest ran 15 API test files and reported 145 passing tests, including the requested referral suites. |
| `pnpm run lint` | 0 | PASS | Workspace lint completed for shared packages, API, and web. |
| `pnpm run type-check` | 0 | PASS | TypeScript checks passed for shared packages, API, and web. |
| `pnpm test` | 0 | PASS | Full test command passed, including shared-utils, API, web, and `scripts/no-legacy-auth.mjs`. |
| `pnpm run build` | 0 | PASS | Shared packages, API, and Vite web production build completed successfully. |
| `pnpm audit --prod` | 1 | FAIL | Audit ran successfully against the registry and found 9 production dependency vulnerabilities: 2 high, 6 moderate, and 1 low. |

## Audit Findings

- High: `drizzle-orm` SQL identifier escaping issue, patched in `>=0.45.2`.
- High: `hono` CORS middleware origin reflection with credentials, patched in `>=4.12.25`.
- Moderate: `react-router` same-origin redirect issue, patched in `>=6.30.4`.
- Moderate: `@opentelemetry/core` W3C Baggage memory allocation issue, patched in `>=2.8.0`.
- Moderate: additional `hono` advisories for static serving, Lambda cookie headers, body limit handling, and Lambda@Edge repeated headers, patched in `>=4.12.25`.
- Low: `esbuild` development server arbitrary file read on Windows, patched in `>=0.28.1`.

The Gate 2 result is FAIL because `pnpm audit --prod` exited 1 due to vulnerabilities.
This was not a registry or network failure.
