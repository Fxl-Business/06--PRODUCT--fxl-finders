# Phase 06 — verify-work artifact

**Phase:** 06 — fxl-financeiro integration + payout CSV export
**Verdict:** ✅ PASS
**Date:** 2026-05-28

## Scope verified

12 active tasks (T02 removed per D-Q; T13 added). Side A in THIS repo (atomic commit);
Side B in the sibling finance repo (branch + patch, never pushed).

## Acceptance evidence

| Task | What | Evidence |
|---|---|---|
| T01 | Seed migration `0006_fxl_financiero_seed.sql` (journaled, D-F) | `pnpm db:migrate` green on fresh + re-run (idempotent ON CONFLICT). DB rows confirmed: `apps.slug='fxl-financiero'` status=active, `webhook_signing_secret` = 64-char hex, product active, price_bands setup 80000/100000/150000 + monthly 8000/10700/20000, commission_rules 30.00/20.00/12. All NOT NULL cols supplied. pgcrypto enabled. |
| T03 | `listFindersWithLockedCommissions` + `generateCsv` + `buildCsvBuffer` added to Phase 05 `payouts/service.ts` | `pnpm tsc --noEmit` clean. Reserve semantics unchanged (createPayoutBatch stamps paid_payout_id, stays locked; markPayoutPaid flips locked→paid). Missing cpf/pix → payable=false + blockedReason (no crash). Grep: no `in_payout`/`payout_batch_id`/`payoutBatches` references. Two-person-approval v1.1 deferral documented in code. |
| T04 | TDD: CSV byte-contract + HMAC sign byte-match + idempotency byte-match | 14/14 unit tests pass. BOM `[EF BB BF]`; pinned header `finder_name,cpf,pix_key,pix_key_type,amount_brl,commission_ids`; `1.234,56`/`10,00` pt-BR; verifyHmac accepts inline-signed MAC; idempotency = plain sha256 byte-matches buildIdempotencyKey + HMAC-mistake negative guard. |
| T05 | `payouts/routes.ts` — GET finders-ready, POST batches, GET batches/:id/csv | tsc clean. requireAdmin + getAdminDb (no setTenantContext). 422 finder_not_payable surfaced. CSV sets `text/csv; charset=utf-8` + Content-Disposition. Mounted in server.ts. |
| T06-T08 | Side B schema + checkout pages + webhook sender | Sibling repo `pnpm tsc --noEmit` clean in apps/api AND apps/site. Inline HMAC byte-matches (proven by T04). idempotency = createHash sha256 (D-N). D-M body. fxl_sig store-only (D-P). |
| T09/T10 | Admin payout UI | apps/web tsc clean. All calls via apiFetch/apiFetchBlob + Clerk token (D-J grep: no bare fetch('/api, no apiClient.). Missing cpf/pix → disabled checkbox + badge. CSV via Blob + `<a download>`. mark-paid confirm dialog. i18n in BOTH pt-BR + en (key-equality test 8/8). |
| T11 | Cross-repo patch export | `docs/nexo/cross-repo/06-financeiro-integration.patch` (11 files, header w/ env + review note). Branch `feat/fxl-finders-integration` local only — NOT on any remote. |
| T12 | UAT doc + gates | `docs/nexo/verify/06-financeiro-integration-uat.md` (11 TCs, PT-BR). D-A gate 0 matches. Lint 0 errors. |
| T13 | Automated e2e contract test | `test/rls/conversion-webhook-contract.test.ts` — valid sig → 200 accepted + conversion + ≥1 commission + leads + webhook_events; replay → 200 duplicate (counts unchanged); wrong sig → 401 generic. 3/3 pass against live Postgres:5006 with the seeded secret. |

## Gate results

- **API type-check:** ✅ clean
- **apps/web type-check:** ✅ clean
- **API unit tests:** ✅ 122/122 (11 files; +14 Phase 06 payouts TDD)
- **API integration tests:** ✅ 19/19 (6 files; +3 Phase 06 webhook-contract), stable across 3 runs
- **apps/web tests:** ✅ 8/8 (i18n key-equality)
- **Lint:** ✅ 0 errors (apps/api 0; apps/web 0 errors + 20 pre-existing react-refresh warnings in router.tsx)
- **D-A slug gate:** ✅ 0 matches for `fxl-financeiro` across all Phase 06 deliverables
- **fxl-financiero apps/api + apps/site type-check:** ✅ clean

## Fix applied during verify

- **Integration test cross-contamination:** the new conversion-contract test and the
  pre-existing conversion-ingest test both call `ingestConversion` (global
  conversions/webhook_events + hash-chained audit_log). Vitest's default parallel
  file workers raced on the shared test DB → ingest test's attribution/dedup assertions
  failed. Fix: `fileParallelism: false` on the integration project in `vitest.config.ts`
  (correct for a single shared-DB integration suite). Verified deterministic across 3 runs.

## LOCKED decisions honored

D-A (slug fxl-financiero), D-B (requireAdmin), D-C (getAdminDb BYPASSRLS), D-J (apiFetch+token),
D-M (webhook body field set), D-N (plain-sha256 idempotency_key), D-O (verifyHmac, generic 401),
D-P (fxl_sig store-only), D-Q (single payouts table, reserve→pay, no batch tables), D-R (seed cols,
cookie attrs), D6 (two-person approval deferred). One scheduler (no second cron added).
