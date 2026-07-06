---
id: 20260706-hub-auth-fxl-sales
milestone: hub-auth-fxl-sales
status: done
mode: autopilot
---

# Hub-Only Auth Integration + FXL Sales Rename

## Frame

Integrate the product with FXL Hub for `product.fxl-sales`.
Rename visible and package identity to `fxl-sales`, while leaving the repository folder name unchanged.
Remove the retired auth provider path entirely.

## Acceptance

- Given the API boots, when Hub env vars are present, then it mounts the Hub BFF at `/auth/*`.
- Given an API request carries a Hub bearer token, when protected routes run, then they read `userId`, `orgId`, `userRole`, and Hub auth context from verified Hub claims.
- Given the web app renders, when auth hooks are used, then they use the Hub browser client for login, token retrieval, logout, and workspace switching.
- Given a workspace lacks `sales.core`, when a protected API request is made, then the app returns a gated entitlement error before tenant data access.
- Given the repo identity is renamed, when build and test commands run, then workspace package names, filters, page titles, health service names, and visible strings use `fxl-sales`.
- Given tracked files are scanned, when the removed auth provider name is present, then the repository test guard fails.

## Scope Limits

- Do not rename the root folder in this session.
- Do not rotate or invent `FXL_HUB_SECRET_KEY`.
- Do not run a user-id data re-key outside schema naming cleanup.
- Do not rename existing local database names or roles in this slice because that is an ops migration.

## Slice Index

| Slice | Status | Depends on | Acceptance |
| --- | --- | --- | --- |
| 01-identity-and-config | done | [] | API/web package identity and Hub env config support `fxl-sales`. |
| 02-api-hub-bff-auth | done | [01-identity-and-config] | API mounts `/auth/*`, verifies Hub tokens, and gates `sales.core`. |
| 03-web-hub-client-auth | done | [01-identity-and-config, 02-api-hub-bff-auth] | Web app uses Hub auth hooks and Hub client. |
| 04-operational-cutover | done | [02-api-hub-bff-auth] | Finder/seller provisioning is operator-owned through Hub. |
| 05-remove-retired-provider | done | [02-api-hub-bff-auth, 03-web-hub-client-auth] | Retired auth packages, routes, envs, docs, and references are removed. |
| 06-verify-capture | done | [02-api-hub-bff-auth, 03-web-hub-client-auth, 04-operational-cutover, 05-remove-retired-provider] | Full local verification passes or blockers are recorded in `AUDIT.md`. |
