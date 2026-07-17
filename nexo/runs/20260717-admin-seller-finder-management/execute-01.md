# Execute report - Slice 01 Cadastros people management

## Outcome

Status: PASS with one external visual-audit concern.

Commit: `3cfb6221d0b073600af7403139b3fb085cc28987`

Commit message: `feat(sales-ops): move people management to cadastros`

## RED evidence

### RED 1 - Navigation ownership

Command: `pnpm --filter @fxl-sales/web test -- src/sales-ops/__tests__/navigation.test.ts`

Result: expected failure with 5 failing navigation tests.

- Cadastros metadata still read `Catálogo e regras` instead of `Pessoas, catálogo e regras`.
- Tático still returned `dashboard`, `vendedores`, and `finders` instead of only `dashboard`.
- `/cadastros/vendedores` redirected to `/tatico/dashboard` instead of resolving canonically.
- `/tatico/vendedores` remained accepted instead of redirecting to `/tatico/dashboard`.
- `workspaceForView('vendedores', ['admin'])` returned `tatico` instead of `cadastros`.

### RED 2 - Rendered management boundary

Command: `pnpm --filter @fxl-sales/web exec vitest run src/sales-ops/__tests__/routing.test.tsx`

Result: expected failure in `keeps people management in Cadastros and personal people panels read-only`.

The Cadastros person card had no `Editar Alex Silva` accessible action, and the pre-change view-based control model still made the same people views editable in Meus dados.

### RED 3 - API authorization boundary

Command: `pnpm --filter @fxl-sales/api exec vitest run src/domains/sales-ops/__tests__/routes.test.ts`

Result: expected failure with 6 authorization cases.

- Seller, finder, and undefined roles received 201 from `POST /people` instead of 403.
- Seller, finder, and undefined roles received 200 from `PATCH /people/:id` instead of 403.
- The rejected requests reached the mocked mutation services before the fix.

## GREEN evidence

- `pnpm --filter @fxl-sales/web exec vitest run src/sales-ops/__tests__/navigation.test.ts src/sales-ops/__tests__/routing.test.tsx`: PASS, 20 tests.
- `pnpm --filter @fxl-sales/api exec vitest run src/domains/sales-ops/__tests__/routes.test.ts`: PASS, 10 tests.
- `pnpm --filter @fxl-sales/web type-check`: PASS.
- `pnpm --filter @fxl-sales/api type-check`: PASS.
- Focused ESLint for all changed API and web TypeScript and TSX files: PASS.
- `git diff --check`: PASS.
- Routing oracle output contains no React Router future-flag warnings after enabling both planned flags in the two MemoryRouter harnesses.
- The commit hook ran `pnpm perf:audit`: PASS.

## Files committed

- `CLAUDE.md`
- `apps/api/src/domains/sales-ops/routes.ts`
- `apps/api/src/domains/sales-ops/__tests__/routes.test.ts`
- `apps/web/src/sales-ops/navigation.ts`
- `apps/web/src/sales-ops/SalesOpsApp.tsx`
- `apps/web/src/sales-ops/__tests__/navigation.test.ts`
- `apps/web/src/sales-ops/__tests__/routing.test.tsx`

## Acceptance and security review

- Tático contains only the KPI dashboard page.
- Cadastros owns the administrator seller and finder list, create, and edit routes while preserving Produtos as its default.
- Meus dados retains seller and finder metrics in non-interactive `article` cards, including for an account with both admin and a personal role.
- Person create and edit actions require an admin role and the active Cadastros people route.
- Only `POST /people` and `PATCH /people/:id` gained the shared `requireAdmin` middleware.
- `GET /people` and the remaining reads stay available behind the existing application authentication boundary.
- People services still receive `c.get('orgId')`, and body tenant identifiers are stripped before service execution.
- Static legacy route trees, person schemas, data models, KPI formulas, and personal scoping were not changed.

## Concerns

The authenticated browser screenshot audit could not run because browser runtime discovery returned no available browser backend, even though the local web, API, and Hub ports were active.
No browser or server process was started by this agent.
The real exported SalesOpsApp routing oracle remains the automated user-flow evidence for this execution.

## Task review repair - Route-bound people dialog

Commit: `36105bb0a97b5c05b0b0eade91ffaa284061f32a`

Commit message: `fix(sales-ops): close people dialog outside cadastros`

### RED evidence

Command: `pnpm --filter @fxl-sales/web exec vitest run src/sales-ops/__tests__/routing.test.tsx`

Result: expected failure with 1 of 11 tests failing.

The new `closes people management when the mounted app leaves Cadastros` oracle opened the `Pessoa` dialog at `/cadastros/vendedores`, navigated within the same mounted React tree to `/tatico/dashboard`, and received the existing `Pessoa` heading instead of `null`.
This proved that person modal state survived route transitions and remained actionable outside Cadastros.

The existing personal-panel oracle was also strengthened to click each non-interactive person `article` and prove no person dialog opens.

### GREEN evidence

- `pnpm --filter @fxl-sales/web exec vitest run src/sales-ops/__tests__/routing.test.tsx`: PASS, 11 tests.
- `pnpm --filter @fxl-sales/web type-check`: PASS.
- `pnpm --filter @fxl-sales/web exec eslint src/sales-ops/SalesOpsApp.tsx src/sales-ops/__tests__/routing.test.tsx`: PASS.
- `git diff --check`: PASS.
- The commit hook ran `pnpm perf:audit`: PASS.

The fix clears person modal state through workspace and sidebar navigation and independently requires `canManagePeople` when deriving the `PersonDialog` modal prop.
The oracle proves the dialog and save action disappear in Tático and Meus dados, personal article clicks remain inert, and returning to Cadastros does not resurrect the prior dialog.

## Gate 2 repair - Browser history invalidation

Commit: `b30f6b43bd1637f61d75e0296a0f948b4223e262`

Commit message: `fix(sales-ops): clear people dialog on history changes`

### RED evidence

Command: `pnpm --filter @fxl-sales/web exec vitest run src/sales-ops/__tests__/routing.test.tsx`

Result: expected failure with 1 of 12 tests failing.

The new `does not restore a stale people dialog through browser history` oracle started at `/cadastros/vendedores` with `/tatico/dashboard` in MemoryRouter history, opened `Pessoa`, clicked raw Back, then clicked raw Forward.
Back correctly hid the dialog through the existing render gate, but Forward restored the stale `Pessoa` heading instead of `null` at `/cadastros/vendedores`.

### GREEN evidence

- `pnpm --filter @fxl-sales/web exec vitest run src/sales-ops/__tests__/routing.test.tsx`: PASS, 12 tests.
- `pnpm --filter @fxl-sales/web type-check`: PASS.
- `pnpm --filter @fxl-sales/web exec eslint src/sales-ops/SalesOpsApp.tsx src/sales-ops/__tests__/routing.test.tsx`: PASS.
- `git diff --check`: PASS.
- The commit hook ran `pnpm perf:audit`: PASS.

The immediate `PersonDialog` permission gate remains in place.
A deferred cleanup effect keyed by `canManagePeople` now invalidates person modal state after every route transition away from administrator Cadastros, including URL-driven Back and Forward navigation.

## Incremental review repair - Irrevocable history cleanup

Commit: `0a9ea70689680f44469e42bdc85e52e03ae47aaf`

Commit message: `fix(sales-ops): make people dialog cleanup irrevocable`

### RED evidence

Command: `pnpm --filter @fxl-sales/web exec vitest run src/sales-ops/__tests__/routing.test.tsx`

Result: expected failure with 1 of 13 tests failing.

The new `irrevocably clears people dialogs during rapid browser history transitions` oracle held the departure cleanup microtask, synchronously committed Back to Tático and Forward to Cadastros inside one React act, then released the held cleanup.
The previous dependency cleanup had set its `active` flag to false during the false-to-true transition, so the stale `Pessoa` heading remained instead of becoming `null`.

### GREEN evidence

- `pnpm --filter @fxl-sales/web exec vitest run src/sales-ops/__tests__/routing.test.tsx`: PASS, 13 tests.
- `pnpm --filter @fxl-sales/web type-check`: PASS.
- `pnpm --filter @fxl-sales/web exec eslint src/sales-ops/SalesOpsApp.tsx src/sales-ops/__tests__/routing.test.tsx`: PASS.
- `git diff --check`: PASS.
- The commit hook ran `pnpm perf:audit`: PASS.

Unmount protection now uses a separate mounted ref and is no longer coupled to `canManagePeople` dependency cleanup.
Every departure callback remains eligible after a rapid return and clears only the exact modal instance captured on departure, so it cannot close a newer valid dialog.

## Incremental review repair - Route-specific people dialogs

Commit: `887ec0197512923cd551613c66f377c5849779bb`

Commit message: `fix(sales-ops): bind people dialogs to their routes`

### RED evidence

Command: `pnpm --filter @fxl-sales/web exec vitest run src/sales-ops/__tests__/routing.test.tsx`

Result: expected failure with 1 of 14 tests failing.

The new `closes route-specific people dialogs when history switches people pages` oracle opened `Novo vendedor` at `/cadastros/vendedores`, navigated Back directly to `/cadastros/finders`, and still received the `Pessoa` heading instead of `null`.
The same oracle covers the symmetric finder-to-seller history transition and verifies that neither dialog resurrects when history returns.

### GREEN evidence

- `pnpm --filter @fxl-sales/web exec vitest run src/sales-ops/__tests__/routing.test.tsx`: PASS, 14 tests.
- `pnpm --filter @fxl-sales/web type-check`: PASS.
- `pnpm --filter @fxl-sales/web exec eslint src/sales-ops/SalesOpsApp.tsx src/sales-ops/__tests__/routing.test.tsx`: PASS.
- `git diff --check`: PASS.
- The commit hook ran `pnpm perf:audit`: PASS.

Immediate dialog rendering and deferred identity-preserving cleanup now share the exact route contract.
Seller hints are valid only on `cadastros/vendedores`, finder hints only on `cadastros/finders`, and collaborator hints are valid on neither people route.
The mounted-ref and exact-modal identity protections for rapid transitions and newer dialogs remain unchanged.
