# Phase 04 — Code Review

**Phase:** 04 — Referral links + signed redirect + click telemetry
**Date:** 2026-05-28
**Verdict:** PASS (0 Critical / 0 Warning remaining / 2 Info). 2 findings fixed inline during `--auto`.

Reviewed all source files changed/added in Phase 04: `packages/shared-utils/src/hmac.ts`, `apps/api/src/db/schema.ts` (referral_links + clicks), `apps/api/drizzle/0003_nostalgic_jubilee.sql`, `apps/api/src/middleware/auth.ts` (setTenantContext type), `apps/api/src/domains/links/{service,routes}.ts`, `apps/api/src/domains/finder/routes.ts`, `apps/api/src/server.ts`, `apps/api/src/env.ts`, `apps/site/src/lib/{db,ua-family,click-handler,rate-limit}.ts`, `apps/site/src/app/r/[code]/route.ts`, `apps/web/src/finder/**`, `apps/web/src/lib/api-client.ts`.

## Findings

| # | Severity | File | Issue | Resolution |
|---|---|---|---|---|
| 1 | Warning | `apps/api/src/domains/finder/routes.ts` | `GET /finder/clicks?linkId=<garbage>` passed a non-UUID directly to the `clicks.link_id` uuid column → Postgres `22P02` → unhandled 500 (info-leaking stack via error middleware). | FIXED: added a UUID regex guard in the route — invalid `linkId` → clean `400 validation_error` before the query. |
| 2 | Warning | `apps/api/src/domains/links/service.ts` | `listActiveProductsForFinder` issued a per-product price-band query (N+1) inside the finder catalog read. | FIXED: batched into ONE `inArray(priceBands.productId, ids)` query; empty-products short-circuit. |
| 3 | Info | `apps/site/src/lib/click-handler.ts` | `fxl_ref` cookie sets `Secure` even on local-dev http (browser silently ignores). | Accepted — per D-R spec ("Secure ALWAYS"); documented; does not break the 302. |
| 4 | Info | `apps/site/src/lib/db.ts` | apps/site declares a focused subset of the referral_links/apps/clicks schema (not the full apps/api schema). | Accepted — intentional read/insert-only projection for the Node-runtime route; source of truth stays apps/api/src/db/schema.ts (documented in the file header). |

## Security review (no Critical)

- **Open-redirect**: `validateDestinationHost` / click-handler `hostAllowed` use EXACT host equality (`host === entry`), never substring/suffix. Near-match rejection (`evil-fxl.com.br`, `fxl.com.br.attacker.com`) is unit-tested.
- **Secret exposure**: `GET /finder/apps` projects only `{id,name,slug}` — never `webhook_signing_secret`/`secret_key_hash`. The link `signature` and `webhook_signing_secret` never reach the finder UI.
- **RLS / tenant isolation**: every tenant-scoped service fn wraps in `db.transaction` + `setTenantContext(tx, orgId)` (D-D); cross-tenant invisibility integration-proven. `clicks` is append-only (INSERT+SELECT grant only). Public code lookup is SELECT-only (D-E).
- **HMAC**: `verifyHmac` uses `crypto.timingSafeEqual` with a length guard (constant-time, no throw on length mismatch). `fxl_sig`/`link.signature` byte-verified against D-P.
- **Rate-limit fail-open**: limiter degrades gracefully (no-op) when Upstash absent and fails open on Redis error — never crashes the redirect (documented trade-off; per autopilot KEY reminder).
- **Privacy**: `ip_hash` is `sha256(ip + daily_salt)[:16]` with daily rotation; `click_id`/`ip_hash`/`link_id` never rendered in the finder UI.

## Gates after fixes

- `pnpm --filter @fxl-finders/api type-check` 0 · lint 0 · unit 47/47 · RLS integration 9/9
- Full monorepo type-check 5/5; all tests 95 passing; perf:audit ok.

**Verdict: PASS.**
