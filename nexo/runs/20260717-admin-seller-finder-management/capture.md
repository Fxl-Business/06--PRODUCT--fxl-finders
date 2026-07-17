# Provisional capture - Cadastros people management

## Outcome

Slice 01 passed its independent per-slice Gate 2 at commit `887ec01`.
Tatico now owns only the KPI overview, Cadastros owns administrator seller and finder management, Meus dados keeps read-only personal panels, and people mutations require the administrator boundary.
This capture is provisional until the branch is merged and the full integrated `master` wave verification passes.

## Verification history

The initial Gate 2 failure at `36105bb` found that URL-driven browser history could restore stale person-dialog state.
Three test-first repairs covered normal history transitions, rapid away and return transitions, and direct transitions between seller and finder routes.
The fresh retry verifier passed 24 focused web tests, 10 focused API tests, focused lint, web and API type checks, the diff guard, and authorization and tenant-safety inspection at `887ec01`.

## Remaining work

Authenticated screenshot and pixel QA remains a manual audit item because the runtime exposed no browser backend.
Slice 02 remains parked until Hub deploys an audience-correct product-access account directory and publishes the matching `@fxl-business/hub-sdk` client.
The exact Hub contract remains unchanged in `nexo/plans/20260717-admin-seller-finder-management/02-admin-account-linking.md`.
No account-linking implementation, release, or environment promotion is included in this capture.
