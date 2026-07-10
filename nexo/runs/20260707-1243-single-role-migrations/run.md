# Single Role Migrations

## Summary

Aligned sales database migrations with the standard FXL single project role bootstrap.
Removed application migration responsibility for cluster roles, hard-coded role grants, and role-targeted policies.
Kept tenant isolation by forcing RLS on tenant tables and adding an `app.fxl_admin=true` session context for admin service paths.

## Changes

- Removed `CREATE ROLE`, `ALTER ROLE`, and `GRANT ... TO fxl_sales_*` assumptions from journaled migrations.
- Added `0008_single_role_rls_context.sql` to repair already-migrated staging databases without a reset.
- Updated `getAdminDb()` to fall back to `DATABASE_URL` and set the admin RLS session context.
- Updated integration test setup to load `.env` before Vitest global setup selects database URLs.
- Added a regression test that scans migration SQL for forbidden cluster role management.

## Verification

- `make migrate` passed against the configured staging database.
- Database catalog check returned `migrationCount: 9`, `salesManagedRoleCount: 0`, and `forcedRlsTables: 15` out of `checkedTables: 15`.
- `pnpm --filter @fxl-sales/api test:integration` passed with 7 files and 25 tests.
- `pnpm --filter @fxl-sales/api test` passed with 16 files and 147 tests.
- `pnpm --filter @fxl-sales/api type-check` passed.
- `pnpm --filter @fxl-sales/api lint` passed.
- `pnpm run type-check` passed.
- `pnpm run lint` passed.
- `pnpm test` passed.
- Pre-commit `node scripts/perf-audit.mjs` passed.

## Notes

The multi-agent verifier tooling was available, but this session's tool rules only allow spawning subagents when the user explicitly asks for them.
No release was cut.
