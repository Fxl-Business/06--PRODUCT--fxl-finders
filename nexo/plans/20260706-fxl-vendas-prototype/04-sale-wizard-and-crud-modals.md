---
id: 04-sale-wizard-and-crud-modals
milestone: 20260706-fxl-vendas-prototype
status: done
depends_on: [03-unified-prototype-shell-and-screens]
files_modified: [apps/web/src/sales-ops/SalesOpsApp.tsx, apps/web/src/sales-ops/api.ts, apps/web/src/sales-ops/hooks.ts, apps/web/src/sales-ops/calculations.ts, apps/web/src/sales-ops/__tests__/calculations.test.ts]
acceptance: "Given a user opens the wizard or CRUD modal, when they submit valid data, then the app persists it through the API and refreshed screens show recalculated totals and commissions."
---

# Slice 04 - Sale wizard and CRUD modals

## Scope

Implement the three-step sale wizard from the prototype.
Implement product and client create/edit dialogs.
Wire modal submit buttons to API mutations.

## Test Contract

Write failing tests first for sale payload building and product/client form normalization.
The oracle command is `pnpm --filter @fxl-sales/web test -- src/sales-ops/__tests__/calculations.test.ts`.

## Expected Behavior

Step 1 captures client, seller, optional finder, items, payment condition, receivables, and notes.
Step 2 captures professionals, other costs, commission percentages, tax, and live margin calculation.
Step 3 reviews sale data, payable rows, receivables, and margin before submit.
Saving complete and incomplete sales creates distinct persisted statuses.
Product edit supports sale code suffix, open price, monthly billing, recurring commission, seller plus finder commission, modules, and service providers.

## Out Of Scope

Do not add payment gateway capture.
Do not add bulk import.
