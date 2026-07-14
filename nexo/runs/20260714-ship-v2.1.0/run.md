# Production release v2.1.0

Flow: `nexo-ship-prod-ready`.
Milestone: null.
Gate 3 approval: the user explicitly approved full production promotion (no staging pause) on 2026-07-14.

## Release candidate

Tag: `v2.1.0`.
Release commit: `7e1e5c222f129071d664e99b25c8c68eb8a73d61`.
Previous release: `v2.0.4`.
The minor bump was derived from the `feat` commits since `v2.0.4` (no breaking-change markers).

The release delivers product commission scenarios (seller-with-finder commission persistence, an independent commission-scenario editor, and product-aware sale commission defaults), canonical Sales Ops workspace routes, the Hub SDK 1.2 contract lock with verified claim-type enforcement, and custom sale item labels, plus assorted fixes and docs.

### Database migration

The release ships `0009_product_commission_scenarios.sql`.
It adds two `NOT NULL` columns to `sales_ops_products` (`seller_with_finder_commission_type` default `'pct'`, `seller_with_finder_commission_value`) with an in-migration backfill from the existing seller-commission columns.
The change is additive and backfilled, but the staging and production deploys must run `db:migrate` for the running app to match the schema.

## Release verification

The first independent verifier returned FAIL for the candidate: two integration tests in `apps/api/test/rls/conversion-ingest.test.ts` failed.
Systematic debugging showed the failures were a pre-existing flaky test, not a product bug and unrelated to this release's scope (the release does not touch the conversions domain).
Root cause: the test seeded the click's `created_at` with the Postgres clock (`now()`) while building the webhook `closed_at` with the Node clock (`new Date()`); last-touch attribution requires `click.created_at <= closed_at`, so DB-vs-process clock skew (~35 ms, DB ahead) pushed the click just past `closed_at` and dropped it from the attribution window, throwing `attribution_not_found`.
The second failure (idempotency dedupe) was a pure cascade: the first test's throw rolled back the `webhook_events` insert, so the replay was not seen as a duplicate.

Fix: backdate the seeded click by one hour (`now() - interval '1 hour'`), matching real usage where a click precedes the sale close, making attribution deterministic regardless of clock skew.
This is a test-only change (`test(conversions): deflake attribution ingest clock-skew race`); the domain service was not modified.

A fresh independent verifier then returned PASS for the exact release commit `7e1e5c2`.
Lint, type-check, unit tests (327), build, and the integration suite (27/27) all passed.

## Promotion

The annotated tag `v2.1.0` was created at the release commit and pushed to `origin`.
The installed git does not support `git push --ff-only`; a plain `git push` to a branch already rejects non-fast-forward updates, and each target's ancestry was independently confirmed with `git merge-base --is-ancestor` before pushing, so promotion was fast-forward-only with no force push.
The existing `staging` branch was fast-forwarded from `4e6e2c1` to `7e1e5c2`.
After staging succeeded, the existing `production` branch was fast-forwarded from `4e6e2c1` to the same `7e1e5c2` commit.
Remote `master`, `staging`, `production`, and tag `v2.1.0` all resolved to the release commit immediately after promotion.

The repository has no active Nexo milestone id, so no milestone summary or state advance was required.
