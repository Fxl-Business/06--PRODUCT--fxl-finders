# Autopilot audit - run 20260717-admin-seller-finder-management

## Slice 02 - Admin account linking

- [ ] DEPENDENCY: Hub must deploy an audience-correct product-access account directory and publish the matching `@fxl-business/hub-sdk` client described in `nexo/plans/20260717-admin-seller-finder-management/02-admin-account-linking.md`.
- PARKED: FXL Sales currently receives `product.fxl-sales` tokens, while Hub member and seat routes require the `product.fxl-hub` audience.
- SAFETY: Do not forward the Sales token to Hub-only routes, repurpose `FXL_HUB_SECRET_KEY`, read Hub tables directly, or infer account eligibility from local email addresses.
- RESUME: After the Hub endpoint is deployed and its SDK release is installed, change the slice to `todo`, rerun plan-check and `waves.sh`, then execute its locked tests.
