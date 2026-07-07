# Verify 2 Report

Status: PASS.
Slice: `01-remove-retired-surfaces`.
Started: `2026-07-06T23:13:19-03:00`.
Ended: `2026-07-06T23:14:34-03:00`.

## Commands

### 1. Retired directory absence

Command:

```sh
test ! -d apps/site && test ! -d apps/mobile
```

Exit code: 0.
Result: PASS.
Notes: Both `apps/site` and `apps/mobile` are absent.

### 2. Retired surface reference scan

Command:

```sh
rg -n "apps/(site|mobile)|@fxl-sales/site|fxl-sales-mobile|\b[Ee]xpo\b|expo-router|expo-|EAS|React Native|NativeWind|Next\.js|SITE_URL|VITE_SITE_URL|SITE_PORT|localhost:4006|@vercel/analytics|next-env|next\.config" README.md CLAUDE.md Makefile scripts/setup.sh pnpm-workspace.yaml package.json apps packages -g '!node_modules/**' -g '!dist/**' -g '!build/**'
```

Exit code: 1.
Result: PASS.
Notes: Exit code 1 is expected for this command because `rg` found no matches.

### 3. Targeted referral tests

Command:

```sh
pnpm --filter @fxl-sales/api test -- src/domains/referrals/__tests__/ua-family.test.ts src/domains/referrals/__tests__/click-handler.test.ts
```

Exit code: 0.
Result: PASS.
Notes: Vitest reported 15 test files passed and 145 tests passed under `apps/api`.

### 4. Lint

Command:

```sh
pnpm run lint
```

Exit code: 0.
Result: PASS.
Notes: Workspace lint completed for shared packages, API, and web.

### 5. Type check

Command:

```sh
pnpm run type-check
```

Exit code: 0.
Result: PASS.
Notes: TypeScript checks completed for shared packages, API, and web.

### 6. Full test suite

Command:

```sh
pnpm test
```

Exit code: 0.
Result: PASS.
Notes: Shared-utils passed 17 tests, API passed 145 tests, web passed 23 tests, and `scripts/no-legacy-auth.mjs` completed.

### 7. Build

Command:

```sh
pnpm run build
```

Exit code: 0.
Result: PASS.
Notes: Shared package builds, API build, and Vite web production build completed.

### 8. Production audit

Command:

```sh
pnpm audit --prod
```

Exit code: 0.
Result: PASS.
Notes: The audit reached the registry and reported no known vulnerabilities.
