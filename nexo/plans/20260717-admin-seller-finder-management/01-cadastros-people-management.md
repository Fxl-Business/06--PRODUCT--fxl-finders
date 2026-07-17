---
id: 01-cadastros-people-management
milestone: null
status: done
depends_on: []
files_modified:
  - CLAUDE.md
  - apps/api/src/domains/sales-ops/routes.ts
  - apps/api/src/domains/sales-ops/__tests__/routes.test.ts
  - apps/web/src/sales-ops/navigation.ts
  - apps/web/src/sales-ops/SalesOpsApp.tsx
  - apps/web/src/sales-ops/__tests__/navigation.test.ts
  - apps/web/src/sales-ops/__tests__/routing.test.tsx
acceptance: "Given an administrator or a seller/finder-only user opens Sales Ops, when navigation and people controls render or a people mutation is called, then Tatico exposes only Visao geral, Cadastros owns administrator seller/finder list, create, and edit routes, Meus dados preserves read-only personal panels, and non-admin people mutations return 403."
---

# Slice 01 - Cadastros people management

## Goal

Make Cadastros the only team workspace where administrators list, create, and edit sellers and finders.
Keep Tatico focused on its KPI overview.
Keep the existing Meus dados seller and finder panels readable without exposing team-management actions.
Enforce the same administrator boundary at the API so hiding controls cannot be bypassed by calling the people mutation endpoints directly.

## Exact scope

This slice changes the Sales Ops navigation matrix, canonical route resolution, people-card interaction mode, people create and edit authorization, focused route tests, and the Sales Ops routing note in `CLAUDE.md`.
It reuses the current `PeopleView`, `PersonDialog`, `useSaveSalesOpsPerson`, `PersonSchema`, `UpdatePersonSchema`, `createPerson`, and `updatePerson` contracts.
It does not change the person model, create a second seller or finder UI, or move code into the legacy admin tree.

The administrator navigation matrix becomes exact.

| Workspace | Pages in order |
| --- | --- |
| `tatico` | `dashboard` |
| `operacional` | `vendas`, `comissoes` |
| `cadastros` | `produtos`, `clientes`, `vendedores`, `finders`, `geral` |

Keeping `produtos` first preserves `/cadastros/produtos` as the default route when an administrator switches to Cadastros.
The Cadastros description becomes `Pessoas, catálogo e regras` so workspace metadata matches its broader responsibility.

## Canonical route behavior

`/tatico/dashboard` remains the administrator default and the only valid Tatico page.
An administrator opening the retired team routes `/tatico/vendedores` or `/tatico/finders` is replaced with `/tatico/dashboard` through the existing invalid-route behavior.
No compatibility alias or redirect from those retired page pairs is added because they are no longer valid members of the Tatico workspace.

`/cadastros/vendedores` and `/cadastros/finders` become valid administrator routes.
`workspaceForView('vendedores', ['admin'])` and `workspaceForView('finders', ['admin'])` return `cadastros`.
The same lookup for a seller-only or finder-only role continues to return `meus-dados` for its personal page.

`/meus-dados/vendedores`, `/meus-dados/comissoes`, `/meus-dados/finders`, and `/meus-dados/vendas` remain unchanged for their existing role combinations.
A seller-only or finder-only user who requests any team workspace continues to be replaced with that role's first valid Meus dados route.
An account holding both `admin` and a personal role may open Meus dados, but team create and edit controls still appear only under Cadastros.

The static `/admin/*`, `/seller/*`, `/finder/*`, and `/no-role` route trees remain unchanged.
`apps/web/src/router.tsx` does not need modification because the existing `/:workspace/:view` route delegates membership to `resolveSalesOpsRoute`.

## User-facing E2E reproduction and locked oracle

The rendered routing test is the automated user-flow oracle because it mounts the real exported `SalesOpsApp`, real navigation helpers, real route resolution, and the existing dialog shell inside `MemoryRouter`.
Use a deterministic bootstrap fixture containing one active person with both seller and finder flags so both team and personal cards are observable.

Extend `apps/web/src/sales-ops/__tests__/routing.test.tsx` with a test named exactly:

```ts
it('keeps people management in Cadastros and personal people panels read-only', async () => {});
```

The test first renders `/tatico/dashboard` with `['admin']` and asserts the sidebar page navigation contains only `Visão geral`.
It asserts `Vendedores`, `Finders`, `Novo vendedor`, and `Novo finder` are absent from Tatico.
It then renders `/tatico/vendedores` with `['admin']` and requires replace navigation to `/tatico/dashboard` with the `Visão geral` heading.

The test renders `/cadastros/vendedores` with `['admin']`, requires the `Cadastros` workspace and `Vendedores` heading, and requires the `Novo vendedor` action.
The fixture seller card remains an interactive button with an accessible name equivalent to `Editar <nome>`.
Clicking it must open the existing `Pessoa` edit dialog.
Repeat the route and header assertions for `/cadastros/finders` and `Novo finder`.

The test then renders `/meus-dados/vendedores` with `['seller']` and `/meus-dados/finders` with `['finder']`.
Each route must retain the `Meus dados` workspace, `Meu painel` heading, and visible fixture metrics.
Neither route may render a `Novo vendedor`, `Novo finder`, or `Editar <nome>` button, and no click target may open the person dialog.
Also render `/meus-dados/vendedores` with `['admin', 'seller']` to lock that management location, not merely the presence of the admin role, controls editability.

Use semantic queries against the sidebar, main region, accessible action names, and headings rather than broad document text when duplicate labels exist.
The editable people card must receive `aria-label={`Editar ${person.displayName}`}` for keyboard and assistive-technology discoverability.
The personal card must render as a non-interactive `article` with the same visible card body and metrics, not as a disabled button.

## RED 1 - Navigation ownership

Change `apps/web/src/sales-ops/__tests__/navigation.test.ts` first.
Require the exact Tatico list `['dashboard']` and the exact Cadastros list `['produtos', 'clientes', 'vendedores', 'finders', 'geral']` for `['admin']`.
Require the Cadastros metadata description `Pessoas, catálogo e regras`.
Require `/cadastros/vendedores` and `/cadastros/finders` to resolve without redirect for an administrator.
Require `/tatico/vendedores` and `/tatico/finders` to resolve with `redirect: true` to `/tatico/dashboard`.
Require `workspaceForView` to map administrator people views to `cadastros` while preserving the current personal mappings for seller-only and finder-only roles.
Keep the existing tests that prove personal navigation unions, team-only visibility, multi-role visibility, role defaults, and forbidden team-workspace replacement.

Run this focused command from the repository root without watch mode.

```sh
pnpm --filter @fxl-sales/web test -- src/sales-ops/__tests__/navigation.test.ts
```

The expected RED failure is that Tatico still contains `vendedores` and `finders`, Cadastros lacks them, the new Cadastros routes redirect, and the old Tatico routes are still accepted.

## GREEN 1 - Navigation model

In `apps/web/src/sales-ops/navigation.ts`, reduce `tacticalTeam` to the dashboard item only.
Add the existing seller and finder navigation items to `cadastros` after `clientes` and before `geral`.
Do not introduce another page identifier, route table, or role model.
The existing navigation arrays must remain the sole source of route membership and `workspaceForView` ownership.

Update the Cadastros metadata description and rerun the RED 1 command until it passes.

## RED 2 - Rendered management boundary

Add the rendered test described in the E2E oracle section before changing `SalesOpsApp.tsx`.
Run this focused command without watch mode.

```sh
pnpm --filter @fxl-sales/web test -- src/sales-ops/__tests__/routing.test.tsx
```

The expected RED failure is that `/cadastros/vendedores` and `/cadastros/finders` are not valid, `/tatico/vendedores` remains valid, and Meus dados still exposes `Novo vendedor` or `Novo finder` plus clickable edit cards.

## GREEN 2 - Location-bound UI management

In `SalesOpsApp`, derive one local boolean that is true only when the active workspace is `cadastros`, the active view is `vendedores` or `finders`, and `profile.roles` contains `admin`.
Use that boolean to expose the seller or finder header create action and to supply the people edit callback.
Do not infer permission from the view id alone because the same view ids intentionally power read-only personal panels.

Make `PeopleView.onEdit` optional.
When it exists, render the current card as an interactive button, preserve its visual layout, and add the accessible edit name.
When it does not exist, render the same card body in a non-interactive `article` without hover or button semantics.
Do not duplicate metric calculations or create separate personal and team view components.

Keep the existing title behavior so Cadastros shows `Vendedores` or `Finders` and Meus dados shows `Meu painel`.
Keep personal commissions, indications, and KPI calculations unchanged.
Keep all seller and finder creation and editing in the existing `PersonDialog` and mutation hook.

Rerun the RED 2 command until it passes.
Then run both web oracles together.

```sh
pnpm --filter @fxl-sales/web test -- src/sales-ops/__tests__/navigation.test.ts src/sales-ops/__tests__/routing.test.tsx
```

## RED 3 - API authorization boundary

Create `apps/api/src/domains/sales-ops/__tests__/routes.test.ts` as a Hono route-level test.
Mock `getDb` and the people service functions so authorization, status codes, context forwarding, and handler reachability are tested without PostgreSQL.
Build the test app with middleware that sets a deterministic `orgId` and a configurable `userRole`, then mount the real `salesOpsRouter`.

Lock these cases.

- `GET /people` returns 200 for `seller` and `finder`, proving the read route remains available for personal panels.
- `POST /people` and `PATCH /people/:id` return `403` with `{ error: 'forbidden', reason: 'admin_role_required' }` for `seller`, `finder`, and an undefined role.
- Rejected mutations do not call `createPerson` or `updatePerson`.
- The same POST and PATCH requests reach the mocked service for `admin`, return their existing success statuses, and pass the context `orgId` rather than any tenant identifier supplied by the body.

Use a schema-valid person payload and reset all mocks between cases.
Do not test the middleware by reading source text or by stubbing `requireAdmin` itself.

Run this focused command without watch mode.

```sh
pnpm --filter @fxl-sales/api test -- src/domains/sales-ops/__tests__/routes.test.ts
```

The expected RED failure is that the current POST and PATCH handlers reach the mocked people services and return success for non-admin roles instead of returning 403.

## GREEN 3 - Existing requireAdmin middleware

Import the existing `requireAdmin` middleware into `apps/api/src/domains/sales-ops/routes.ts`.
Attach it directly to `POST /people` and `PATCH /people/:id` after the already-mounted `appAuthMiddleware` boundary.
Leave `GET /people`, `GET /bootstrap`, and every read used by personal KPI pages authenticated but not admin-only.
Do not duplicate role parsing, inspect request-body role or tenant fields, add a new middleware, or move these endpoints into `/api/v1/admin`.

Rerun the RED 3 command until it passes.

## Refactor on green

After all three focused oracles are green, remove any duplicated people-card markup with the smallest local component or shared body that keeps interactive and read-only semantics explicit.
Do not extract a new module unless the final `SalesOpsApp.tsx` code is less clear without it.

The touched `routing.test.tsx` currently emits both React Router v7 future-flag warnings.
Set `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` on both `MemoryRouter` harnesses only after the behavior tests are green.
Rerun the routing oracle and require clean output with no `React Router Future Flag Warning` text.
Do not change production router behavior as part of this warning cleanup.

Update the Sales Ops Routing section of `CLAUDE.md` so its canonical route list is `tatico/dashboard`, `operacional/vendas|comissoes`, `cadastros/produtos|clientes|vendedores|finders|geral`, and `meus-dados/vendedores|comissoes|finders|vendas`.
Record there that seller and finder create or edit controls are admin-only and live under Cadastros, while Meus dados reuses read-only personal panels.

Run the focused type and diff guards.

```sh
pnpm --filter @fxl-sales/web type-check
pnpm --filter @fxl-sales/api type-check
git diff --check
```

## Security considerations

The browser UI is not the authorization boundary.
Both people mutation routes must reject every non-admin request before parsing or service execution through the shared `requireAdmin` middleware.
The middleware must consume only the verified auth context populated by `appAuthMiddleware`.
No `orgId`, workspace id, account id, or role from the request body may influence authorization or tenant selection.

The existing service functions must continue to receive `c.get('orgId')`, and `updatePerson` must retain its tenant-scoped id filter.
Read access stays in scope because the current personal KPI panels depend on bootstrap people data.
This slice does not claim that account-to-person personal scoping exists because that relationship belongs to slice 02.

## Browser E2E and visual verification

With an authenticated administrator, open `/tatico/dashboard` directly and confirm the page navigation shows only `Visão geral`.
Open `/tatico/vendedores` and `/tatico/finders` directly and confirm each is replaced with `/tatico/dashboard` without a stale people card or dialog flash.
Switch to Cadastros and confirm its default remains Produtos, then open Vendedores and Finders and confirm the current cards, empty/loading states, create dialog, and edit dialog retain their spacing, typography, focus states, and 1360 by 860 layout.

With a seller-only account, open `/meus-dados/vendedores` and confirm the existing Meu painel metrics render without a create button, edit cursor, editable card semantics, or person dialog.
With a finder-only account, repeat at `/meus-dados/finders`.
If an administrator also has a personal role, repeat in Meus dados and confirm the location remains read-only.

Capture screenshots of Tatico, both Cadastros people pages, and each available personal panel for pixel review.
If authenticated role fixtures are unavailable, record the exact environment blocker in the run audit and do not substitute a fake production claim for the automated real-component oracle.
Stop the complete process group for every API, Vite, browser helper, or preview process started for this verification.

## Separate Gate 2 verification

After implementation, a different Verify agent runs the named focused oracles and these repository-root commands once without watch mode.

```sh
CI=true pnpm test
pnpm lint
pnpm type-check
pnpm build
pnpm audit --audit-level high
git diff --check
```

The Verify agent must additionally inspect the route diff and confirm that only POST and PATCH people mutations gained `requireAdmin`, all people reads remain authenticated and reachable, no legacy route tree changed, Meus dados has no people-management control, and the routing oracle emits no React Router future-flag warning.

## Scope exclusions

- Do not add the administrator account directory, account-to-person relationship, or link mutation from slice 02.
- Do not create, invite, suspend, or grant product access to Hub accounts.
- Do not add a database migration or change `sales_ops_people` columns.
- Do not alter personal dashboard data scoping, KPI formulas, bootstrap response shape, or TanStack Query keys.
- Do not change product, client, settings, sale, or commission permissions in this slice.
- Do not redesign the Sales Ops shell, change its breakpoint behavior, or introduce new visual primitives.
- Do not rename the shared seller and finder view ids because Meus dados deliberately reuses them.
- Do not modify `/admin/*`, `/seller/*`, `/finder/*`, or `/no-role` behavior.
- Do not cut or promote a release under Autopilot.

## Done contract

The pure navigation oracle proves Tatico has one KPI page, Cadastros owns both administrator people routes, old tactical people pairs are invalid, and personal route ownership is preserved.
The rendered SalesOpsApp oracle proves administrator create and edit controls exist only in Cadastros and Meus dados remains visibly intact and non-interactive for people management.
The Hono route oracle proves non-admin people mutations return 403 before service execution while authenticated people reads remain available.
The focused suites, type checks, diff guard, repository-wide Gate 2 commands, warning-free routing output, and browser visual audit pass or record only a concrete external browser-session blocker.
A separate Verify agent reports PASS before capture.

## Capture commit

Capture this slice as one atomic Conventional Commit after Gate 2 passes.

```text
feat(sales-ops): move people management to cadastros
```
