# Run 20260706-1735-hub-only-removal

Mode: autopilot
Base: `e1b0d7f`
Feature plan: `nexo/plans/20260706-hub-only-removal/00-OVERVIEW.md`

## Frame

Remove the retired auth provider entirely.
Keep FXL Hub as the only integration surface.
Finish exact product identity rename from the old slug to `fxl-sales`, while leaving the folder name unchanged.

## Changes

- Removed retired auth dependencies, middleware branch, browser branch, mobile wrapper, token cache, webhook route, and invite calls.
- Added a tracked-file guard to fail tests if the removed provider name is reintroduced.
- Rewrote docs and agent guides around Hub-only setup and operator prerequisites.
- Renamed database role, DSN, env, and exact product identifiers to `fxl_sales` or `fxl-sales`.
- Added `0007_hub_identity_columns` to migrate existing identity columns and roles to Hub/product names.
- Removed obsolete planning and archival docs that contradicted the Hub-only state.
- Created the local `fxl_sales` database in the existing Docker Postgres container so integration tests can run against the renamed DSN.
- Cleaned ignored local API env values and disabled mobile lint caching so generated cache paths do not reintroduce the folder-name exception.

## Verification

- `pnpm run type-check` passed.
- `pnpm run lint` passed.
- `pnpm test` passed.
- `pnpm run build` passed.
- `pnpm --filter @fxl-sales/api test:integration` passed.
- `pnpm --dir apps/mobile run type-check` passed.
- `pnpm --dir apps/mobile run lint` passed.
- `pnpm run perf:audit` passed.
- `git diff --check` passed.
- Retired auth provider grep returned no matches.
- Old exact product identifier grep returned no matches.
- Broad no-ignore sweeps returned no matches outside excluded dependency/build/git folders.
- Changed-file em dash scan returned no matches.

## Notes

- The repository folder was not renamed by request.
- Production Hub secret and workspace provisioning remain operator-owned.
- Existing local Docker volumes may still contain the pre-rename database.
- New local runs use `fxl_sales`.
