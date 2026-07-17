# Gate 2 verification retry 2 - Slice 01

- Agent: `verify`
- Slice: `01-cadastros-people-management`
- Commit: `887ec0197512923cd551613c66f377c5849779bb`
- Compared from: `b7d85c0`
- Verdict: `PASS`
- Started: `2026-07-17T04:23:30Z`
- Ended: `2026-07-17T04:27:00Z`

## Isolation

This verification read the slice acceptance contract and the complete `b7d85c0..887ec01` diff.
It did not read the context pack, executor report, reviewer messages, or any earlier verifier report or result.

## Command evidence

### Focused web route oracles

```sh
CI=true pnpm --filter @fxl-sales/web exec vitest run src/sales-ops/__tests__/navigation.test.ts src/sales-ops/__tests__/routing.test.tsx
```

Result: exit `0`, 2 files passed, 24 tests passed.
The output contained no React Router future-flag warning.

### Focused API route oracle

```sh
CI=true pnpm --filter @fxl-sales/api exec vitest run src/domains/sales-ops/__tests__/routes.test.ts
```

Result: exit `0`, 1 file passed, 10 tests passed.

### Focused web lint

Run from `apps/web`.

```sh
pnpm exec eslint src/sales-ops/navigation.ts src/sales-ops/SalesOpsApp.tsx src/sales-ops/__tests__/navigation.test.ts src/sales-ops/__tests__/routing.test.tsx
```

Result: exit `0`, no findings.

### Focused API lint

Run from `apps/api`.

```sh
pnpm exec eslint src/domains/sales-ops/routes.ts src/domains/sales-ops/__tests__/routes.test.ts
```

Result: exit `0`, no findings.

The same combined ESLint invocation from the monorepo root was not a valid focused command because the TypeScript parser found both app tsconfig roots.
Running ESLint from each owning workspace resolved the invocation ambiguity and checked every changed TS and TSX product or test file.

### Type checks

```sh
pnpm --filter @fxl-sales/web type-check
pnpm --filter @fxl-sales/api type-check
```

Result: both commands exited `0` with `tsc --noEmit` clean.

### Diff guard

```sh
git diff --check
```

Result: exit `0`, no whitespace errors.

## Acceptance and security inspection

- Tatico ownership passes.
  The navigation source contains only `dashboard`, `/tatico/vendedores` and `/tatico/finders` resolve by replacement to `/tatico/dashboard`, and the rendered oracle exposes only `Visao geral` in the Tatico page navigation.
- Cadastros ownership passes.
  The exact administrator order is `produtos`, `clientes`, `vendedores`, `finders`, `geral`, its default remains Produtos, and both people pages expose the existing create and accessible edit actions only when `canManagePeople` is true.
- Meus dados behavior passes.
  Seller-only, finder-only, and admin plus seller personal routes retain `Meu painel`, metrics, non-interactive `article` cards, and no create, edit, or person-dialog control.
- Mutation authorization passes.
  Only `POST /people` and `PATCH /people/:id` gained the shared `requireAdmin` middleware, and seller, finder, and missing-role requests return the exact 403 response before either service executes.
- Auth context ordering is safe for multi-role administrators.
  The verified Hub claim mapping returns `admin` first for owner, workspace-admin, super-admin, and admin product claims, which satisfies the existing `requireAdmin` contract based on `userRole`.
- Tenant isolation passes inspection and route-level evidence.
  Both handlers pass `c.get('orgId')` to their services, request-body tenant keys are stripped before service calls, `createPerson` overwrites the insert tenant with that org, and `updatePerson` keeps the unchanged `orgId` plus person id predicate.
- Authenticated people reads remain available.
  `GET /people` has no new admin middleware and returns 200 for seller and finder route fixtures.
- Legacy route trees are unchanged.
  The complete diff does not touch `apps/web/src/router.tsx`, so `/admin/*`, `/seller/*`, `/finder/*`, and `/no-role` remain outside this slice.
- Route lifecycle passes.
  The same mounted application clears a person dialog when leaving Cadastros, when browser Back and Forward move between Tatico and Cadastros, when history moves directly between Vendedores and Finders, and when an away and return sequence completes before the queued cleanup callback.
- The person dialog is also render-gated to the matching Cadastros page and role hint, so a stale state cannot flash management UI on a non-owning route.
- The diff contains no account-directory, account-link, schema, migration, service, router-tree, or unrelated permission changes.

## Cannot verify in this environment

Authenticated browser screenshot and pixel review could not be performed because browser discovery returned no available browser backend.
No API, Vite, preview, watcher, or browser helper process was started for this verification.
The real exported application, route helpers, navigation events, dialog shell, and Back and Forward lifecycle remain covered by the focused rendered oracle above.

## Verdict

`PASS`.
The slice acceptance contract, focused machine gates, and independent security inspection are satisfied, with authenticated visual screenshot review recorded as the concrete environment limitation allowed by the plan.
