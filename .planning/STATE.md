# State

**Active milestone:** v1.0 — FXL Finders MVP (started 2026-05-28)
**Active phase:** none yet (Phase 0 of nexo:add-feature workflow completing — research + brainstorm + spec done; Phase 1 scaffold next)
**Workflow:** /nexo:add-feature with /nexo:autopilot active (single human gate at Phase 0 spec approval was skipped per autopilot rule 4 — choices logged inline in spec § 2)
**Token tier:** Tier 2 (6 phases — to be confirmed by /nexo:plan-all)

## Failure list

(none yet)

## Phase 0 decisions log (user-confirmed)

- v1.0 scope: Platform + fxl-financiero only
- Finder onboarding: Public signup + admin approval
- Payout method: Manual + CSV export
- Price band model: Per-product (min, list, max) tuple
- Sellers: First-class in Finders, opt-in Clerk login

## Phase 0 decisions log (autopilot)

- Sale-close trigger: reuse fxl-financiero's `first_paid_at` event on `org_attribution`
- Commission rate model: per-product flat `(setup_rate_pct, recurring_rate_pct, recurring_months)`
- Attribution window: 30-day last-touch, configurable per app (`apps.attribution_window_days`)
- Commission hold: 30-day default, configurable per app (`apps.commission_hold_days`)
- App roles: apps/api backend; apps/web finder portal + admin route-segmented; apps/site public landing + /signup + /r/:code; apps/mobile deferred
- Webhook direction: push (sibling app → FXL Finders), HMAC-SHA256+timestamp

## Deviations from /nexo:add-feature workflow

1. **2026-05-28** — Phase 0 spec-review gate skipped because /nexo:autopilot was activated after question #5. Per autopilot rule 4, autopilot decisions logged inline in spec § 2 ("Autopilot" rows) rather than waiting for user confirmation. User can still reject the spec on the final handoff if desired and we revert.

## Final integration verify v1.0

(not yet — pending Phase 06 + verify-work pass)
