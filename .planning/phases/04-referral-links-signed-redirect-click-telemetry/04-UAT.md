# Phase 04 — Verify-work UAT

**Phase:** 04 — Referral links + signed redirect + click telemetry
**Date:** 2026-05-28
**Verdict:** PASS (autopilot UAT — automated tests + live end-to-end smoke evidence; JWT-gated finder routes verified at the 401 boundary per documented sandbox-Clerk fallback, route logic verified live via dev-passthrough)

Docker Postgres up on :5006. The full referral flow was exercised live: a finder link created via `POST /api/v1/links`, redeemed at `GET http://localhost:<site>/r/<code>` → 302 with `?ref&fxl_sig` + `fxl_ref` cookie, a `clicks` row written, and the finder stats/clicks endpoints reflecting it. `fxl_sig` and `link.signature` were byte-verified against the D-P formula. Upstash creds absent → limiter degraded gracefully (no-op) with `RATE_LIMIT_ENABLED=false`; redirect path worked without live Upstash.

## Verify checklist (from 04-PLAN.md verify gate)

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | `db:generate` run; `referral_links` + `clicks` in latest migration | PASS | `0003_nostalgic_jubilee.sql` has both CREATE TABLEs; journaled in `_journal.json` |
| 2 | `GET /api/v1/links` returns `{links:[]}` for a new finder | PASS | live curl (passthrough) → `{"links":[]}` before create |
| 3 | `POST /api/v1/links` → `{link, fullUrl}`, fullUrl `…/r/<code>` | PASS | live → `fullUrl:"http://localhost:4006/r/1a55ymy6p9"`, link.code=1a55ymy6p9 |
| 4 | `GET /r/<code>` → 302 to dest with `?ref=…&fxl_sig=…` (D-E proven) | PASS | live → `302`, `location: https://checkout.smoke.com/precos?ref=01KSR…&fxl_sig=b597…` (no JWT/tenant ctx → 302 not 410) |
| 5 | `Set-Cookie fxl_ref` HttpOnly; Secure; SameSite=Lax; Max-Age=7776000 (D-R) | PASS | live header `set-cookie: fxl_ref=01KSR…; HttpOnly; Secure; SameSite=Lax; Max-Age=7776000; Path=/` |
| 6 | `fxl_sig = hmac(click_id + "." + link.signature, secret)` (D-P) | PASS | node recompute == URL value byte-exact (MATCH=true) |
| 7 | `clicks` row present after redirect | PASS | DB `total_dev_org_clicks=1`, ua=firefox, ip_hash present |
| 8 | `GET /finder/apps` active apps (no secrets); non-finder → 403 | PASS | live → `{id,name,slug}` only; resolveFinderId throws finder_not_found → 403 design |
| 9 | `GET /finder/clicks` paginated, org-scoped | PASS | live → `{clicks:[1],nextCursor:null}`; org isolation via clicks_select_tenant RLS |
| 10 | `GET /finder/clicks/stats` → `{total:1,unique:1}` after redirect | PASS | live → `{"total":1,"unique":1}` |
| 11 | `GET /r/<invalid>` → 410 | PASS | live → status=410 |
| 12 | `RATE_LIMIT_ENABLED=false` → redirect works without Upstash | PASS | limiter no-op (logged warning), 302 succeeded |
| 13 | `/finder/links` link generator form + "Gerar Link" button | PASS | LinksPage renders generate button + Dialog(LinkGeneratorForm); type-check 0 |
| 14 | Generator shows band validation error when out of band | PASS | LinkGeneratorForm bandCheck disables submit + destructive hint; API 422 on out-of-band (live) |
| 15 | `/finder/clicks` renders clicks table | PASS | ClicksPage + ClicksTable (5 cols, no click_id/ip_hash/link_id) |
| 16 | Conversion rate KPICard shows `'—'` (not a number) | PASS | ClicksPage conversionRate KPICard value="—", isLoading=false |
| 17 | api/site/web type-check exit 0 | PASS | `pnpm -r type-check` 5/5 Done |
| 18 | api unit tests pass (HMAC, band, EXACT host incl. near-match, ULID, resolveFinderId) | PASS | api unit 47/47; links service 19 (band×5, signature, code, host EXACT incl. evil-fxl/suffix reject) |
| 19 | api integration: public-lookup (D-E) + cross-tenant (D-D) as fxl_finders_app (D-G) | PASS | api:integration 9/9 (referral-links-public-lookup 3, list-finder-links-cross-tenant 2, prior 4) |
| 20 | site tests: ua-family (all branches) + click-handler (410/410/500/302) | PASS | site 14/14 (ua 8: bot/edge/opera/firefox/safari-not-chrome/chrome/null/unknown; click-handler 6) |
| 21 | shared-utils tests pass | PASS | shared-utils 17/17 (sign/verify/referral/hashIp/dailySalt) |
| 22 | No `any` in new files; named exports only | PASS | grep `:any/as any` new files → 0; grep `^export default` new files → 0 |
| 23 | `grep VITE_DATABASE_URL` → 0 | PASS | 0 matches |
| 24 | `referral_links_public_lookup` in journaled migration (D-E/D-F) | PASS | grep `referral_links_public_lookup apps/api/drizzle/` → 1; `pg_policies` shows all 4 policies |
| 25 | `setTenantContext` inside `db.transaction` in all tenant fns (D-D) | PASS | links service `db.transaction` count = 6 (createLink/list/revoke/stats/clicks + finder reads); resolveFinderId in each |
| 26 | clicks grants: no UPDATE/DELETE (append-only) | PASS | DB grant `clicks | INSERT,SELECT`; migration GRANT-clicks UPDATE/DELETE → 0 |
| 27 | leads hard FKs promoted (link_id, click_id, ON DELETE SET NULL) | PASS | DB `leads_link_id_fk` + `leads_click_id_fk` present |
| 28 | FORCE RLS on referral_links + clicks | PASS | DB `relforcerowsecurity=true` both |
| 29 | i18n: finder.links.* + finder.clicks.* + nav.clicks in BOTH pt-BR + en | PASS | keys-resolve.test.ts 8/8 (key-set equality EQUAL=True) |
| 30 | No raw Clerk IDs / click_id / ip_hash rendered in finder UI | PASS | grep `user_/org_/usr_` apps/web/src/finder tsx → 0; ClicksTable omits click_id/ip_hash/link_id |

## Gates

- `pnpm -r type-check` → 5/5 Done (shared-types, shared-utils, api, site, web)
- api lint 0, site lint 0, web lint 0 errors (15 pre-existing react-refresh warnings — badge/button/router lazy imports, none from Phase 04 files)
- Tests: shared-utils 17 · api unit 47 · api RLS integration 9 · site 14 · web 8 = **95 passing**
- `pnpm run perf:audit` → ok
- 10/10 LOCKED grep contract gates clean

## LOCKED decisions honored

D-D (tx-scoped setTenantContext) · D-E (referral_links_public_lookup → valid code 302 not 410, integration-proven) · D-F (RLS appended into journaled migration; pg_policies confirms) · D-P (fxl_sig + link.signature formulas byte-verified) · D-B (clerkAuthMiddleware wired in server.ts; 401 without JWT) · D-G (RLS tests as fxl_finders_app) · D-H (getDb/getAdminDb, no db singleton) · D-J (frontend via apiFetch + Clerk token) · D-R (cookie attrs, ua-family + click-handler tests).

**Verdict: PASS.**
