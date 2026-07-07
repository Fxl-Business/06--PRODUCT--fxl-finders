---
id: 03-unified-prototype-shell-and-screens
milestone: 20260706-fxl-vendas-prototype
status: done
depends_on: [02-web-data-client-and-hooks]
files_modified: [apps/web/src/router.tsx, apps/web/src/index.css, apps/web/src/sales-ops/SalesOpsApp.tsx, apps/web/src/sales-ops/navigation.ts, apps/web/src/sales-ops/__tests__/navigation.test.ts]
acceptance: "Given sales operations data is loaded from the API, when a user navigates the app, then the visible shell and primary screens match the prototype layout and render live loading, empty, and loaded states."
---

# Slice 03 - Unified prototype shell and screens

## Scope

Replace the current fragmented role home experience with the prototype workspace shell.
Render tactical, operational, and configuration workspaces.
Render dashboard, sales, sellers, finders, commissions, products, clients, and general settings screens from live API data.

## Test Contract

Write failing render or pure view-model tests first for route and view model behavior.
The oracle command is `pnpm --filter @fxl-sales/web test -- src/sales-ops/__tests__/calculations.test.ts`.

## Expected Behavior

The shell uses Figtree and Space Grotesk, dark sidebar, light content panel, rounded surfaces, and the prototype color tokens.
The collapsed sidebar remains stable and does not resize content unexpectedly.
Every data view follows loading, empty, and loaded states.
No raw account or workspace ids are rendered in customer-facing UI.

## Out Of Scope

Do not build a landing page.
Do not preserve old placeholder routes as primary navigation.
