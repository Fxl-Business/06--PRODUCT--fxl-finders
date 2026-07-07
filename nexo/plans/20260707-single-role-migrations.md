# fix(db): align migrations with the standard single database role

Milestone: none

## Frame

`make migrate` fails on staging because the sales Drizzle migrations try to create and alter cluster roles.
All other FXL project databases are provisioned by `create-db.sh`, which creates one database owner role and gives the app a single `DATABASE_URL`.

## Acceptance Criteria

Given a database provisioned by the standard FXL `create-db.sh` script, when `make migrate` runs with only `DATABASE_URL`, then migrations do not require `CREATEROLE`, `BYPASSRLS`, `MIGRATE_DATABASE_URL`, or `ADMIN_DATABASE_URL`.
Given migration SQL is reviewed, when tests scan the Drizzle files, then no cluster role DDL, role grants, or role-targeted policies are present.
Given tenant tables are owned by the standard project role, when runtime queries use the normal app DB handle, then forced RLS still enforces tenant policies.
Given admin services request an admin DB handle, when only `DATABASE_URL` is configured, then `getAdminDb()` reuses the standard database URL with the `app.fxl_admin=true` session setting.

## Test Contract

Red test: `pnpm --filter @fxl-sales/api test -- src/db/__tests__/single-role-db-contract.test.ts`
Green proof: the same test passes after the migration SQL and DB client align with the single-role pattern, and `pnpm --filter @fxl-sales/api test:integration` proves forced RLS still isolates tenants.
