# Phase 05 — Code Review Artifact

**Phase:** 05 — Conversion ingestion + commission ledger + audit
**Date:** 2026-05-28
**Verdict:** ✅ PASS — 1 Critical found + fixed, 0 Warnings open, 2 Info accepted.
**Scope:** all source changed/added in Phase 05 (api domains conversions/commissions/payouts/audit/sellers, jobs, schema, migration, web admin pages, api-client, i18n).

---

## Critical (found + fixed)

### C1 — `refund` event mis-booked as a positive commission on the sale path
- **File:** `apps/api/src/domains/conversions/service.ts`
- **Problem:** `WebhookBodySchema` accepts `event_type: 'sale' | 'refund'`. `ingestConversion` (mounted at `POST /api/v1/conversions`, the SALE path) did not guard `event_type`. A `refund` event hitting `POST /` would run the full sale flow and INSERT **positive** commission rows — a money-correctness bug (refunds must reduce, not add). Refunds are meant to flow through `POST /api/v1/conversions/refund` → `reverseCommission` (negative rows / status flip).
- **Fix:** Added an explicit guard at the top of `ingestConversion`: `if (body.event_type !== 'sale') throw new Error('unsupported_event_type')`. Route maps it to `422` (a 4xx so financeiro retries/alerts — D-M discipline, never a silent drop). Re-verified: type-check + 108 unit + 16 integration green.

---

## Info (accepted, no v1.0 code change)

### I1 — `POST /refund` has no idempotency guard for already-paid commissions
- A replayed refund webhook for a `paid` commission would insert a duplicate negative row (the in-place pending/locked case is naturally idempotent via the `status === 'reversed'` skip). Refund-via-webhook idempotency is a documented v1.0 gap (the spec's refund replay defense is deferred); financeiro is not expected to replay refunds in v1.0. Flagged for v1.1 (add a `refund` idempotency_key dedupe mirroring the sale path).

### I2 — `writeAuditEntry` uses one `db: any` (eslint-disabled, documented)
- The structural db/tx handle is `any` with an inline `eslint-disable` + rationale; the public `WriteAuditEntryInput` is fully typed. Accepted: the alternative (a precise union of getDb()/getAdminDb()/tx types) adds significant generic noise for no safety gain at the single call boundary. Consistent with the Phase 04 `setTenantContext` structural-type deviation.

---

## Verified-good (spot checks)

- **HMAC middleware (D-O):** raw body via `.clone().arrayBuffer()` before parse; generic 401 for all failure modes (grep oracle = 0); dummy-secret verify on missing app (no timing oracle); lowercase-hex sig regex matches `verifyHmac` output.
- **Idempotency:** two-level guard (webhook_events ON CONFLICT + conversions.idempotency_key UNIQUE), both return `{ isDuplicate: true }`.
- **Commission calc:** `Number()` coercion of Drizzle numeric STRING; `Math.floor` int cents; recurring = monthly×rate%×months.
- **State machine (D-K):** no `approveCommission`, no `/approve` route, no `*→approved`; auto path pending→locked via `promoteHoldExpired`.
- **Audit chain (D7/D8):** prev_hash is the prepended hash arg (NOT inside canonical_json); genesis `'0'*64`; FOR UPDATE tail lock; verifyChain excludes both hashes from recompute. Live ledger verified valid.
- **RLS (D-C/D10/D-F):** split-INSERT policies present; payouts no RLS; app role no UPDATE on commissions; admin grants include clicks/referral_links SELECT (needed by the BYPASSRLS ingest); all in the journaled migration.
- **D-Q payouts:** single table; reserve (paid_payout_id, stays locked) vs mark-paid (only locked→paid); missing cpf/pix → 422 not crash; no payout_batches.
- **Frontend:** loading discipline, KPICard, no raw UUIDs (display names), i18n pt-BR/en parity, query invalidation on mutations.
