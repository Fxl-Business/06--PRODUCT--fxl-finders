---
id: 20260706-hub-only-removal
milestone: hub-auth-fxl-sales
status: done
mode: autopilot
---

# Hub-Only Removal Slice

## Frame

Remove the retired auth provider completely and keep FXL Hub as the only auth and commerce integration.
Finish the product rename to `fxl-sales` everywhere except the physical repository folder.

## Acceptance

- Given the API boots, when protected routes are mounted, then Hub is the only auth path.
- Given the web app renders, when auth hooks run, then they call the Hub browser client only.
- Given the mobile app builds, when its root layout renders, then it has no retired provider wrapper or token cache.
- Given tracked files are scanned, when retired auth provider text exists, then the test guard fails.
- Given tracked files are scanned, when old exact product identifiers exist, then the manual sweep returns no matches.
- Given a database was created before this rename, when migrations run, then identity columns and app roles move to the new names.

## Scope Limits

- Do not rename the repository folder in this slice.
- Do not invent or rotate Hub secrets.
- Do not delete or recreate user data.
- Do not build a rollback path.

## Verification Contract

- `pnpm run type-check`
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`
- `pnpm --filter @fxl-sales/api test:integration`
- `pnpm --dir apps/mobile run type-check`
- `pnpm --dir apps/mobile run lint`
- `pnpm run perf:audit`
- `git diff --check`
- Retired auth provider grep returns no matches.
- Old exact product identifier grep returns no matches.
