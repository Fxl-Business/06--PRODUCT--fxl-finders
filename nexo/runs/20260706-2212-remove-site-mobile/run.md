# Remove Retired Site And Mobile Surfaces

## Summary

Removed the retired public site and Expo mobile app from the repository.
The repo now contains the API, web app, and shared packages as active workspaces.
Moved public referral redirects to the API at `/r/:code` so generated referral links do not depend on the removed app.
Updated dependency metadata, docs, Make targets, setup flow, and shared-package comments to match the reduced surface area.

## Changes

- Deleted `apps/site` and `apps/mobile`.
- Removed site and mobile workspace references, Make targets, setup steps, and docs.
- Added API-owned referral redirect handling under `apps/api/src/domains/referrals`.
- Replaced `SITE_URL` with API-owned `PUBLIC_LINK_BASE_URL`.
- Regenerated the root lockfile without the removed app workspaces.
- Resolved the production audit gate by updating vulnerable production dependencies and moving `tailwindcss-animate` to web dev dependencies.

## Verification

Initial Gate 2 failed only on `pnpm audit --prod`.
The first verifier report is `nexo/runs/20260706-2212-remove-site-mobile/agents/verify-report.md`.

After audit remediation, a fresh verifier passed:

- `test ! -d apps/site && test ! -d apps/mobile`
- retired surface reference scan with no matches
- `pnpm --filter @fxl-sales/api test -- src/domains/referrals/__tests__/ua-family.test.ts src/domains/referrals/__tests__/click-handler.test.ts`
- `pnpm run lint`
- `pnpm run type-check`
- `pnpm test`
- `pnpm run build`
- `pnpm audit --prod`

Final verifier report: `nexo/runs/20260706-2212-remove-site-mobile/agents/verify2-report.md`.

## Result

Gate 2 passed.
No release was cut.
