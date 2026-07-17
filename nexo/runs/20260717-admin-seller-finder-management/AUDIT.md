# Autopilot audit - run 20260717-admin-seller-finder-management

## Slice 02 - Admin account linking

- [ ] DEPENDENCY: Hub must deploy an audience-correct product-access account directory and publish the matching `@fxl-business/hub-sdk` client described in `nexo/plans/20260717-admin-seller-finder-management/02-admin-account-linking.md`.
- PARKED: FXL Sales currently receives `product.fxl-sales` tokens, while Hub member and seat routes require the `product.fxl-hub` audience.
- SAFETY: Do not forward the Sales token to Hub-only routes, repurpose `FXL_HUB_SECRET_KEY`, read Hub tables directly, or infer account eligibility from local email addresses.
- RESUME: After the Hub endpoint is deployed and its SDK release is installed, change the slice to `todo`, rerun plan-check and `waves.sh`, then execute its locked tests.

## Slice 01 - Browser visual validation

- [ ] TEST: Open `/tatico/dashboard` as an administrator and confirm its page navigation contains only `Visão geral`.
- [ ] TEST: Open `/cadastros/vendedores` and `/cadastros/finders` as an administrator and confirm create and edit controls retain their spacing, focus states, dialogs, and responsive layout.
- [ ] TEST: Open the matching `Meus dados` pages as seller-only, finder-only, and admin plus personal role accounts and confirm people cards are read-only and no person dialog survives browser Back or workspace navigation.
- BLOCKED: The in-app browser runtime reported no available browser backend, so authenticated screenshots and pixel review could not be captured automatically.
- AUTOMATED COVERAGE: The real exported `SalesOpsApp` routing oracle covers the same route, role, dialog, and in-place history transitions without React Router warnings.

## Slice 01 - Gate 2 history

- HISTORY: The first independent Gate 2 at `36105bb` returned FAIL because browser history could hide a person dialog and restore its stale state after returning to Cadastros.
- REPAIR: `b30f6b4` added URL and Back or Forward history invalidation with a locked rendered oracle.
- REPAIR: `0a9ea70` made departure cleanup survive rapid away and return transitions without closing a newer dialog.
- REPAIR: `887ec01` bound seller and finder dialogs to their exact Cadastros routes so direct history transitions between people pages cannot retain or resurrect a mismatched dialog.
- VERIFIED: A fresh verifier reported PASS at `887ec01` in `verify-retry2-01.md` after 24 focused web tests, 10 focused API tests, lint, type checks, the diff guard, and security inspection passed.
- PENDING: The branch has not yet been merged to `master`, so full integrated wave verification remains mandatory before this slice is considered landed.

## Tooling observation

- [ ] REVIEW: A fresh offline `pnpm install --frozen-lockfile` completed but reported that the existing esbuild build script is ignored.
- CONTEXT: No dependency or lockfile change belongs to this feature, and the repository already has a separate pnpm build-approval plan.
