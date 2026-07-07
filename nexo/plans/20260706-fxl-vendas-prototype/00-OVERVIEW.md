---
id: 20260706-fxl-vendas-prototype
milestone: 20260706-fxl-vendas-prototype
status: doing
mode: autopilot
---

# FXL Vendas prototype migration

## Frame

Migrate the `.demo/fxl-vendas-finders` prototype into the real `apps/web` React application with Shadcn and Tailwind.
The current application is not the product source of truth for this work.
The prototype in `.demo/fxl-vendas-finders/project/FXL Vendas.dc.html` is the source of truth when it conflicts with existing pages.

## Why

The user needs the prototype turned into a real application, not a static mock.
CRUD flows must persist through the API and must not rely on the prototype seed arrays or frontend mock state.
The final UI must match the prototype closely enough for visual review at 1360 by 860 and at mobile widths.

## Source Order

1. `.demo/fxl-vendas-finders/README.md`.
2. `.demo/fxl-vendas-finders/project/FXL Vendas.dc.html`.
3. Prototype screenshots when they agree with the primary HTML source.
4. Existing repo conventions in `AGENTS.md`, `CLAUDE.md`, `apps/web/AGENTS.md`, and `apps/api/AGENTS.md`.

## Acceptance Criteria

Given a signed-in user, when they open the web app, then they see a unified FXL Vendas workspace shell that follows the prototype layout, palette, typography, density, sidebar, header, and content surfaces.
Given the backing database has no records, when any dashboard, list, or detail view loads, then the UI shows loading and empty states and does not render copied prototype seed rows.
Given an operator creates or edits a product, client, seller, finder, or sale through the app, when the app reloads, then the changed data still appears because it was persisted through the API.
Given an operator records a sale through the wizard, when they confirm it, then the API creates the sale, generates receivable and payable rows, and dashboard, commissions, seller, finder, product, and client summaries update from persisted data.
Given an operator saves an incomplete sale, when they return to the sales list, then it appears as a draft or previsto sale and can still be completed later.
Given a user switches between tactical, operational, and configuration workspaces, when they choose a route, then the available navigation and metrics reflect the selected role without exposing raw account or workspace ids.
Given the viewport is 1360 by 860 or a narrow mobile viewport, when the app renders each migrated screen, then text does not overlap or overflow controls and the primary layout remains usable.
Given Gate 2 runs locally, when verification completes, then API tests, web tests, lint, typecheck, build, and a visual browser check are green before any merge or completion claim.

## Scope Limits

Do not add hosted CI or GitHub Actions.
Do not cut a release or promote staging or production in autopilot.
Do not copy prototype seed data into production runtime as default rows.
Do not replace Hub auth with another auth system.
Do not implement external payment gateway behavior.
Do not manually edit generated migration metadata.

## Slice Index

| Slice | Name | Depends On | Acceptance |
| --- | --- | --- | --- |
| 01 | Sales operations API | none | The API exposes persisted CRUD and dashboard summary data for the prototype domain. |
| 02 | Web data client and hooks | 01 | The web app reads and mutates sales operations data through typed TanStack Query hooks. |
| 03 | Unified prototype shell and screens | 02 | The app renders the prototype workspace shell and primary dashboard, lists, and detail panels from live data. |
| 04 | Sale wizard and CRUD modals | 03 | The wizard and product/client modals create and update persisted records with recalculated summaries. |
| 05 | Pixel QA and integration hardening | 04 | The migrated UI passes local verification and browser screenshot review without mock rows or visual regressions. |

## Waves

All slices are intentionally serial.
The slices share routing, API contracts, and screen state, so parallel implementation would create avoidable merge conflicts.

