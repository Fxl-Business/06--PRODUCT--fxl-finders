# Phase 02 — Verify-Work (UAT) artifact

**Phase:** 02 — Apps + products + price bands admin
**Date:** 2026-05-28
**Verdict:** ✅ PASS
**Mode:** Autopilot (no human gate); live Clerk creds are sandbox placeholders (documented fallback).

---

## Gate results

| Gate | Command | Result |
|---|---|---|
| Monorepo type-check | `pnpm -r type-check` | ✅ 5/5 projects PASS |
| API unit tests | `pnpm --filter @fxl-finders/api test` | ✅ 21/21 (keys + app-schema + price-band/commission schemas) |
| API lint | `pnpm --filter @fxl-finders/api lint` | ✅ exit 0 |
| Web type-check | `pnpm --filter @fxl-finders/web type-check` | ✅ exit 0 |
| Web lint | `pnpm --filter @fxl-finders/web lint` | ✅ exit 0 (6 pre-existing react-refresh warnings on shadcn badge/button + lazy router consts; non-blocking) |

## LOCKED grep gates (all 0 real matches — only doc comments mention the patterns)

- D-B `users.getUser` in admin domain / require-admin → 0 real calls (matches are comment lines only).
- D-B `adminAuthMiddleware` / `adminAuth.ts` → file does not exist; 0 real symbols.
- 02 RLS `setTenantContext(` call in `apps/api/src/domains/admin` → 0 (matches are comments).
- D-J bare `fetch('/api` / `apiClient.get` in `apps/web/src/admin` + `api-client.ts` → 0 real (one comment match).
- `: any` / `as any` in new admin files → 0.
- `export default` in new admin files → 0 (named exports only).

## Live integration smoke test (against Postgres localhost:5006, getAdminDb / BYPASSRLS)

Ran end-to-end through the real service layer + live DB:

- ✅ `createApp` returns `{ secretKeyPlaintext (sk_…), webhookSigningSecretPlaintext (whs_…), app }`; publishable key `pk_…`.
- ✅ Secret stored as SHA-256 hash (verified `secret_key_hash === sha256(plaintext)`), NOT plaintext; prefix `sk_e65cdxxx`.
- ✅ `rotateSecretKey` → new `sk_…` plaintext; DB hash changes.
- ✅ `rotateWebhookSigningSecret` → new `whs_…` plaintext.
- ✅ `updateApp` (no slug in payload) + `setAppStatus('disabled')` apply correctly.
- ✅ `upsertPriceBand` ON CONFLICT (product_id, component) updates in place (1 row, value updated 100000→110000).
- ✅ `upsertCommissionRule` stores rate as numeric `'30.00'`.
- ✅ 5 `audit_log` rows written: `app.created, app.rotate_secret_key, app.rotate_webhook_secret, app.updated, app.set_status` (actor from JWT userId).
- ✅ `listProducts(appId)` JOIN returns `appName`.

## Server / route wiring

- ✅ API boots on :3006; `/health` → 200.
- ✅ `GET /api/v1/admin/apps` mounted; without Bearer token → 401 (`clerkAuthMiddleware` enforces). With a verified non-admin JWT → 403 via `requireAdmin` (logic unit-verified; admin role from JWT claim only). Live admin JWT not mintable here (sandbox placeholder Clerk key) — documented fallback.

## must_haves checklist

- [x] Admin CRUD for apps/products/price_bands/commission_rules (API verified live; UI compiles + wired).
- [x] Secret key SHA-256 hashed; plaintext returned once; cleared from client state on modal close (keyed remount).
- [x] Webhook signing secret stored plaintext.
- [x] KeyRevealModal: warn → confirm → reveal → copy; close clears state; not-copied AlertDialog guard.
- [x] No `setTenantContext` in any admin route/service.
- [x] All new UI strings via `useTranslation()`; PT-BR + EN keys added.
- [x] Backend gate = shared `requireAdmin` reading `c.get('userRole')`; no adminAuth/getUser.
- [x] `AdminGuard` reads Clerk client `publicMetadata.role` (UX redirect only).
- [x] All admin frontend calls via `apiFetch(path,{method,token,body})` with `getToken()`; api-client default port 3006.
- [x] `allowedRedirectHosts` bare-hostname Zod rule (not `.url()`).
- [x] Security mutations write plain `audit_log` rows (Phase 05 hash-chain TODO noted).
- [x] Price-band boundary tests + slug-immutability test pass.
- [x] All TanStack mutations call `invalidateQueries()`.
- [x] api + web type-check + lint pass.
- [x] `keys.test.ts` passes.

## Deviations

1. **UI-SPEC**: produced inline (`02-UI-SPEC.md`) under autopilot rather than the interactive `/gsd-ui-phase` flow (which would pause). Heavy CRUD UI built to the spec: tables (skeleton/empty/content), dialogs, badges, tabbed product detail, reveal-once modal.
2. **No toast library installed** — success feedback is via dialog-close + query invalidation + inline "Saved!" button label (avoids adding a new dependency out of scope). Plan's `toast()` calls replaced with this lighter pattern.
3. **react-hooks/set-state-in-effect**: the newer ESLint rule flagged the dialog "reset form state on open" effect. Refactored all three dialogs (App/Product/KeyReveal) to the idiomatic React "reset state via `key`" pattern (keyed inner form component) — no effects, lint clean.
4. **Pre-existing template defect fixed**: `apps/web/eslint.config.js` referenced `@eslint/js` + `typescript-eslint` not in apps/web devDeps (lint never ran for web) — added them (same fix Phase 01 applied to apps/api).
