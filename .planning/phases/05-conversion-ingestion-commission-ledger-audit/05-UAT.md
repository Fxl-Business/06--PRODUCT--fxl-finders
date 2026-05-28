# Phase 05 — Verify-Work (UAT) Artifact

**Phase:** 05 — Conversion ingestion + commission ledger + audit
**Milestone:** v1.0 — FXL Finders MVP
**Date:** 2026-05-28
**Verdict:** ✅ PASS (28/28 criteria verified)

Verification mode: automated gates (type-check / lint / unit / integration) + live E2E webhook smoke against Docker Postgres:5006 + LOCKED grep gates + DB introspection (`pg_policies`, `information_schema.role_table_grants`, `pg_class.relrowsecurity`).

---

## Tasks: 14/14 executed

| Task | Status | Evidence |
|---|---|---|
| T01 schema (conversions, commissions, payouts) | ✅ | 3 tables in `schema.ts`; type-check 0 |
| T02 migration + RLS (split-INSERT, D-C/D-F) | ✅ | `0004_huge_warbird.sql` journaled; `pg_policies` confirms 6 policies |
| T03 commissions service + state machine (TDD) | ✅ | 30 unit tests; string-rate coercion verified |
| T04 audit hash-chain writer (TDD) | ✅ | 14 unit tests; `verifyChain` tamper detection |
| T05 conversions ingest (TDD) | ✅ | 17 unit tests + live ingest |
| T06 conversions routes + HMAC middleware | ✅ | Live E2E: 200/duplicate/401×3 |
| T07 Clerk user.created webhook (svix) | ✅ | svix `Webhook.verify`; getAdminDb backfill |
| T08 commissions routes + payouts service/routes | ✅ | D-Q reserve/mark-paid; type-check 0 |
| T09 nightly-job (node-cron) | ✅ | `0 3 * * *`; promote pending→locked live |
| T10 admin conversions list | ✅ | ConversionsPage + KPICards + display names |
| T11 admin commissions list + badge | ✅ | CommissionsPage + lock/reverse + 5-state badge |
| T12 admin audit log viewer | ✅ | AuditLogPage + page/full chain check |
| T13 RLS integration tests + gates | ✅ | 16 integration tests; all gates green |
| (UI-SPEC) | ✅ | Inline plan layout consumed (autopilot no-pause, as Phases 02-04) |

---

## Acceptance criteria → evidence

### Money / security core
1. ✅ **HMAC verify on RAW body before parse (D-O)** — `hmac-middleware.ts` reads `c.req.raw.clone().arrayBuffer()` before any JSON parse; payload `ts + "." + rawBody`. Live: valid sig → 200; bad sig → 401; expired ts → 401; unknown source → 401.
2. ✅ **Generic 401, no oracle (D-O)** — grep `unknown_source|signature_expired|invalid_signature|missing_signature|invalid_body` in hmac-middleware = **0**. Every failure mode returns `{ error: 'unauthorized' }`. Dummy-secret verify on missing app (no timing oracle).
3. ✅ **Idempotency two-level dedupe** — webhook_events `ON CONFLICT(source,event_id) DO NOTHING` + conversions.idempotency_key UNIQUE. Live replay → `{ status: 'duplicate' }`, exactly 1 conversion row.
4. ✅ **buildIdempotencyKey = sha256(source+order+event) (D-N)** — unit test asserts byte-match vs plain `createHash`. Phase 06 byte-matches this helper.
5. ✅ **Commission calc (setup + recurring + reversal, string rate)** — `calculateSetupCommission(100000,'30.00')→30000`; `calculateRecurringCommission(10700,'20.00',12)→25680`; `Number()` coercion of Drizzle numeric STRING verified. Live ingest produced setup=30000, recurring=25680.
6. ✅ **Realized basis, zero→no row (D4)** — `buildCommissionRows` skips zero-amount components; empty array for fully-zero conversion.
7. ✅ **Reversal of paid = NEW negative row (immutable original)** — `reverseCommission` inserts `amount_brl = -original` with status='reversed' when paid; updates in place for pending/locked.
8. ✅ **State machine (D-K)** — `isValidTransition`: pending→locked ✓, locked→paid ✓, *→reversed ✓, pending→paid ✗, reversed terminal ✗. NO `*→approved`. No `approveCommission` fn (grep=0). No `/approve` endpoint (grep=0, matches are comments).
9. ✅ **Auto path pending→locked, NO manual action (D-K)** — `promoteHoldExpired` UPDATEs `WHERE status='pending' AND hold_until<now()`. Integration test: backdate hold → promote → ≥2 locked, 0 approved.

### Audit hash-chain
10. ✅ **entry_hash = sha256(prev_hash || canonical_json) (D8)** — `computeEntryHash` matches formula; genesis `'0'*64`.
11. ✅ **canonical_json sorted keys (D7)** — `canonicalJson({b:2,a:1})→'{"a":1,"b":2}'`.
12. ✅ **verifyChain integrity** — detects broken prev_hash link + tampered entry_hash with `brokenAt` index. Live ledger (conversion.recorded + 2× commission.created) verified valid via integration test.
13. ✅ **writeAuditEntry FOR UPDATE tail + actor='system' for webhook** — `.for('update')` on tail row inside tx; webhook entries actor='system'.
14. ✅ **Every admin money mutation writes audit in same tx (D-C)** — lockCommission/reverseCommission/createPayoutBatch/markPayoutPaid each call writeAuditEntry inside their tx.

### RLS / connection discipline (D-C / D-D / D10 / D-F)
15. ✅ **conversions + commissions split-RLS** — `pg_policies`: `conversions_insert_webhook`(INSERT,CHECK true) + `conversions_select_tenant`(SELECT,org_id); `commissions_insert_webhook` + `commissions_tenant`. Integration test: app-role INSERT with no context ✓; finder sees own org only; cross-org zero.
16. ✅ **payouts NO RLS** — `pg_class.relrowsecurity = f` for payouts.
17. ✅ **NO commissions_update_admin USING(true) (D-C)** — no such policy in pg_policies; app role has only SELECT,INSERT on commissions (no UPDATE grant). Admin UPDATEs run on BYPASSRLS getAdminDb().
18. ✅ **RLS appended into journaled migration (D-F)** — RLS/grants in `0004_huge_warbird.sql` (journaled); no standalone `*phase05*.sql`. `pg_policies` confirms post-migrate.
19. ✅ **leads webhook-INSERT policy (D-L)** — `leads_insert_webhook WITH CHECK(true)` added; SELECT stays tenant-scoped.
20. ✅ **Admin reads/transitions on getAdminDb(); setTenantContext only on finder routes (D-C/D-D)** — grep: setTenantContext appears only on `commissionsRouter.get('/')` + `payoutsRouter.get('/')` (finder), never on admin routers.

### Ingest completeness (D-L / D-M)
21. ✅ **Quoted snapshot from referral_links** — live: conversion.quotedSetupBrl=100000, quotedMonthlyBrl=10700 pinned from link.
22. ✅ **customer_email_hash = sha256(email+org_id)** — live: matches `hashCustomerEmail`.
23. ✅ **leads PII row status='converted'** — live: lead with customer_name/cpf inserted.
24. ✅ **rawBodyHash passed from route, stored verbatim** — webhook_events.body_hash = route-supplied hash (not recomputed).
25. ✅ **Attribution: click_id in-window → finder_code fallback → attribution_not_found 422 (D-M)** — service resolves click then code; throws on neither; route maps to 422 (never silent drop).
26. ✅ **WebhookBodySchema = D-M field set** — finder_code optional + customer_name/phone/cpf; negative realized rejected; event_type enum.

### Payouts (D-Q)
27. ✅ **Single payouts table; reserve vs mark-paid** — createPayoutBatch stamps paid_payout_id (stays locked); markPayoutPaid flips locked→paid (only path). finder_payout_details_missing → 422 (not crash). NO payout_batches/payout_batch_id/in_payout (grep=0 in code).

### Frontend + i18n + clerk
28. ✅ **Admin UI loading discipline + KPICard + no raw UUIDs + i18n parity** — ConversionsPage/CommissionsPage/AuditLogPage follow isLoading→skeleton / empty→EmptyState / data→table; KPICard with isLoading; display names (no raw Clerk IDs); pt-BR+en key-set equality test 8/8. svix Clerk webhook backfills sellers.clerk_user_id (D-I clerkClient singleton path; no @clerk/backend import).

---

## Gate results

| Gate | Result |
|---|---|
| `pnpm -r type-check` | ✅ 5/5 packages, 0 errors |
| api lint | ✅ 0 errors |
| web lint | ✅ 0 errors (18 pre-existing react-refresh warnings in router.tsx, unchanged) |
| api unit tests | ✅ 108/108 |
| shared-utils tests | ✅ 17/17 |
| web unit tests | ✅ 8/8 (i18n key-set equality) |
| RLS + ingest integration | ✅ 16/16 |
| LOCKED grep gates | ✅ all clean (D-O oracle 0, D-K /approve 0 real, D-C setTenantContext finder-only, D-Q artifacts 0, default exports 0, @clerk/backend clerkClient 0) |
| Live E2E webhook smoke | ✅ valid→200 accepted; replay→200 duplicate; bad-sig/unknown-source/expired→401; DB rows + commission calc + leads + audit chain verified |

**Total: 16 + 17 + 8 + 108 = 149 passing tests.**
