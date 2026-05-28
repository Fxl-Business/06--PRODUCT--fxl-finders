# Phase 02 — Code Review

**Phase:** 02 — Apps + products + price bands admin
**Date:** 2026-05-28
**Verdict:** ✅ PASS (1 Critical found + fixed, 0 outstanding)
**Scope:** all files created/modified in T01–T09.

---

## Findings

### CRITICAL-1 — `listApps` / `getApp` leaked `webhook_signing_secret` + `secret_key_hash` (FIXED)
`db.select().from(apps)` returned every column, so `GET /api/v1/admin/apps` and
`GET /api/v1/admin/apps/:id` (and the embedded `app` in the create/rotate responses)
sent the plaintext `webhook_signing_secret` (a live HMAC credential) and the
`secret_key_hash` over the wire to any admin client. This defeats the reveal-once
design and is a credential-exposure bug.

**Fix:** added `PublicAppRow = Omit<AppRow,'secretKeyHash'|'webhookSigningSecret'>`
+ `toPublicApp()` projection in `apps/service.ts`. `listApps`, `getApp`, `updateApp`,
`setAppStatus`, and the `app` field of `createApp` now return the projected row.
Plaintext secrets are returned ONLY by `createApp` / `rotateSecretKey` /
`rotateWebhookSigningSecret` (the deliberate reveal-once paths) as separate fields.
Verified live: list/get/create responses no longer contain `secretKeyHash` or
`webhookSigningSecret`.

### WARNING — none.

### INFO (no action this phase)
- I-1: audit_log rows use placeholder `prev_hash`/`entry_hash` = `'0'*64`. Intentional
  Phase 02 deferral (D-R) — Phase 05 hash-chain backfills. `// TODO(Phase 05)` noted.
- I-2: `react-refresh/only-export-components` warnings on shadcn `badge.tsx`/`button.tsx`
  (export `*Variants`) and `router.tsx` (lazy consts beside `router`). Cosmetic HMR
  warnings; do not fail lint. Pre-existing pattern for the shadcn files.
- I-3: No toast lib — success UX via dialog-close + invalidation + inline "Saved!".
  Acceptable for v1.0; a toast system can be added project-wide later.

## Checks performed
- FXL contract: named exports only ✓; no `any` ✓; functional components ✓;
  `invalidateQueries` (no `resetQueries`) ✓; array-hook `select` guards ✓.
- D-B: admin gate = shared `requireAdmin` (JWT claim), no `users.getUser`, no `adminAuth` ✓.
- D-C/02: admin tables no RLS, `getAdminDb()`, no `setTenantContext` ✓.
- D-J: all frontend calls via `apiFetch` + Clerk token; port 3006 ✓.
- Money: int cents end-to-end; rates numeric stored as string ✓.
- Error handling: 400 (Zod), 404 (not found), 409 (slug unique violation), 500 (rethrow → errorMiddleware) ✓.
- Tests: keys (4), app-schema slug+hostname (7), price-band+commission boundary (10) = 21 pass ✓.

## Gates after fix
- `pnpm -r type-check` → PASS (5/5)
- `pnpm --filter @fxl-finders/api lint` → 0
- `pnpm --filter @fxl-finders/web lint` → 0 (6 pre-existing warnings)
- `pnpm --filter @fxl-finders/api test` → 21/21
- `pnpm run perf:audit` → ok (stub)
