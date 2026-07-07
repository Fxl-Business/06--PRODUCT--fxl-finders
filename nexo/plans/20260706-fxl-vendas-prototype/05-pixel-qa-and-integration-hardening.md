---
id: 05-pixel-qa-and-integration-hardening
milestone: 20260706-fxl-vendas-prototype
status: done
depends_on: [04-sale-wizard-and-crud-modals]
files_modified: [apps/web/src/sales-ops/SalesOpsApp.tsx, apps/web/src/index.css, apps/api/drizzle/0007_marvelous_valeria_richards.sql, nexo/runs/20260706-2039-fxl-vendas-prototype/run.md, nexo/runs/20260706-2039-fxl-vendas-prototype/AUDIT.md]
acceptance: "Given the migration is implemented, when local verification and browser visual review run, then the app passes tests, lint, typecheck, build, and pixel checks without mock data or overlapping UI."
---

# Slice 05 - Pixel QA and integration hardening

## Scope

Run verification and visual review.
Fix text overflow, layout shifts, missing empty states, and behavior gaps found during browser testing.
Capture the Nexo run and audit any item that needs human testing or release approval.

## Test Contract

The oracle commands are `pnpm test`, `pnpm run lint`, `pnpm run type-check`, and `pnpm run build`.
The visual oracle is a local browser screenshot at 1360 by 860 and at a mobile width.

## Expected Behavior

No visible mock seed rows appear when the API returns empty arrays.
The primary dashboard, sales list, product modal, and wizard match the prototype geometry and density closely.
The app remains usable with the sidebar collapsed and on narrow widths.
The final audit lists any manual release or environment validation steps.

## Out Of Scope

Do not run `/nexo-ship`.
Do not push staging or production in autopilot.
