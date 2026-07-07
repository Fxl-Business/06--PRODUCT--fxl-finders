---
id: 01-sales-operations-api
milestone: 20260706-fxl-vendas-prototype
status: done
depends_on: []
files_modified: [apps/api/src/db/schema.ts, apps/api/src/domains/sales-ops/service.ts, apps/api/src/domains/sales-ops/routes.ts, apps/api/src/domains/sales-ops/__tests__/service.test.ts, apps/api/src/server.ts]
acceptance: "Given an authenticated request, when clients, product catalog details, sellers, finders, sales, payables, receivables, settings, and dashboard summaries are created, listed, or updated, then the API persists tenant-safe data and returns calculated rows without mock data."
---

# Slice 01 - Sales operations API

## Scope

Add a dedicated sales operations API domain for the prototype's direct CRUD surface.
Persist clients, extended product catalog data, sales, sale items, sale professionals, receivables, payables, and settings.
Reuse existing sellers and finders concepts where possible, but do not make the UI depend on prototype arrays.

## Test Contract

Write failing API unit tests first in `apps/api/src/domains/sales-ops/__tests__/service.test.ts`.
The oracle command is `pnpm --filter @fxl-sales/api test -- src/domains/sales-ops/__tests__/service.test.ts`.

## Expected Behavior

Creating a sale calculates totals, receivables, seller commission, optional finder commission, professional costs, tax, other costs, and net margin.
Listing the dashboard summary aggregates only persisted records.
Updating a product or client changes future reads and does not mutate unrelated tenant data.
Money is stored as integer cents.
Tenant-owned tables carry `org_id` and service reads filter by the authenticated org.

## Out Of Scope

Do not seed demo rows.
Do not implement payment processing.
Do not change existing public referral link conversion semantics.
