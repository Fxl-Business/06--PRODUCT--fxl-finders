# Sales Ops Workspace Visibility Follows the Hub Role Set

## Context

The Sales Ops shell showed a "Nível de visualização" switcher that let the user pick a single active "role view" (Equipe / Vendedor / Finder) as an ephemeral per-session preference.
That switcher was a prototype leftover: the app already derives the user's full multi-role set from Hub claims (`profile.roles: AppRole[]`, `AppRole = 'admin' | 'seller' | 'finder'`), yet workspace visibility was almost unfiltered (only `cadastros` was hidden from non-team).
The real product has three roles - team, seller, finder - and a user can hold one or many.
"Team" is not a Hub product role: the Hub product config defines only `seller` and `finder`, and `admin` is synthesized in-app from the Hub workspace `owner`/`admin` flag (`getRolesFromHubClaims`).

## Decision

Drive workspace visibility purely from the Hub role set and remove the viewing-level switcher.
`getVisibleWorkspaces(roles)` in `apps/web/src/sales-ops/navigation.ts` is the single visibility authority:

- `admin` (team) -> `tatico` + `operacional` + `cadastros`.
- holding `seller` or `finder` -> adds the `meus-dados` workspace.
- so seller-only or finder-only sees only `meus-dados` (and defaults there); team-only sees the three team workspaces and no `meus-dados`; team + seller/finder sees all four; zero recognized roles keeps `/no-role`.

Keep "team" derived from the Hub workspace owner/admin flag - do not add a `team` product role to the Hub.
`meus-dados` reuses existing view components (seller: `vendedores` "Meu painel" + `comissoes`; finder: `finders` "Meu painel" + `vendas` "Indicações"); it is not a new page.
Every Sales Ops navigation function is keyed on `readonly AppRole[]`, not a single role view; `SalesOpsRoleView` and `getSalesOpsRoleViews` were removed.

## Consequences

- The URL stays the single source of truth: a route pointing at a workspace the user cannot see redirects to their role default via `resolveSalesOpsRoute`.
- Visibility is frontend-only; backend/RLS remains authoritative for data scoping, so `meus-dados` panels show only the user's own data because the API scopes by their token.
- No Hub product-config change and no API change; the seller/finder product roles plus the workspace-admin flag fully express the three app roles.
- Adding a future workspace is a compile error until handled: `getSalesOpsNavigation` switches exhaustively over `SalesOpsWorkspace` with no `default`.
- The legacy `/admin/*`, `/finder/*`, `/seller/*`, `/no-role` route trees are untouched.
