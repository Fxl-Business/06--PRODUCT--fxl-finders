# Roadmap

## Milestone v1.0 — FXL Finders MVP (in progress, started 2026-05-28)

Standalone B2B affiliate SaaS + fxl-financiero integration. Tier 2 (6 phases). See `docs/superpowers/specs/2026-05-28-fxl-finders-v1-design.md` for the canonical design.

| # | Phase | Status | Commit | Wave |
|---|---|---|---|---|
| 01 | Schema foundation + Clerk auth + RLS | ⏳ pending | — | W1 |
| 02 | Apps + products + price bands admin | ⏳ pending | — | W2 |
| 03 | Finder onboarding + portal shell | ⏳ pending | — | W2 |
| 04 | Referral links + signed redirect + click telemetry | ⏳ pending | — | W3 |
| 05 | Conversion ingestion + commission ledger + audit | ⏳ pending | — | W4 |
| 06 | fxl-financiero integration + payout CSV | ⏳ pending | — | W5 |

**Dependencies:** 02 and 03 both depend on 01 (parallelizable). 04 depends on 02 and 03. 05 depends on 04. 06 depends on 05 and touches the fxl-financiero repo (cross-repo work, manual diff handoff — no auto-commit).

**Verify gate (each phase):** `/gsd-execute-phase N` → `/gsd-verify-work N` (mandatory per Nexo v1.27+ verify-phase-gate). Then `/gsd-code-review N` + `/gsd-code-review-fix N --auto` per Phase 3.5 of nexo:add-feature workflow.

## Template baseline (inherited)

Scaffolded from `fxl-template` v1.0.0 (4 apps + 2 shared packages + Clerk + Hono + Drizzle + Postgres docker-compose + shadcn/ui + i18n PT-BR/EN). Template's own milestone history is retained in the template repo, not here.
