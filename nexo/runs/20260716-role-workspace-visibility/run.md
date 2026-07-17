---
run: 20260716-role-workspace-visibility
milestone: v2.2.0
flow: feature
mode: autopilot
trunk: master
status: complete
outcome: 2/2 slices landed on master, 0 parked
---

# Run: role-driven workspace visibility + UTF-8 name fix

## What shipped (to `master`, not yet promoted)

Two slices, one wave, built serially (see "Execution note"), each Execute verified by a separate fresh agent, then an integration wave-verify on `master`.

| Slice | Commit | Verify | Merge |
| --- | --- | --- | --- |
| 01-utf8-jwt-decode | `8aaff69` | PASS (claims 8/8, token 8/8, type-check, lint) | `d6a0b29` |
| 02-role-driven-workspace-visibility | `750554e` | PASS (navigation 10/10, routing 8/8, full web 74/74, type-check, lint) | `32f2161` |

Integration wave-verify on `master` @ `32f2161`: `pnpm type-check`, `pnpm lint`, `pnpm test` (33 files / 255 tests) plus the `no-legacy-auth` guard all PASS.

## Slice 01 - UTF-8 JWT decode

Fixed the account-switcher mojibake ("Gestão FXL" rendered as "GestÃ£o FXL").
Root cause: `parseJwtPayload` in `apps/web/src/auth/claims.ts` used `atob`, which reads the JWT payload's UTF-8 bytes as Latin-1.
Fix: decode base64 to bytes and interpret as UTF-8 via `TextDecoder`.
Refactor: `readJwtExpiry` in `apps/web/src/auth/token.ts` now reuses `parseJwtPayload` (one-directional import, no cycle), removing the duplicated inline decode.

## Slice 02 - role-driven workspace visibility

Replaced the prototype "Nível de visualização" viewing-level switcher with visibility driven by the real Hub role set (`profile.roles: AppRole[]`).
Added a `meus-dados` workspace that reuses existing panels.
Re-keyed `navigation.ts` from a single `SalesOpsRoleView` to `readonly AppRole[]`, adding `getVisibleWorkspaces` as the single visibility authority; removed `SalesOpsRoleView` and `getSalesOpsRoleViews`.
`SalesOpsApp.tsx` now derives the workspace list, default route, and no-role guard from roles; the header switcher became a static identity block.

Visibility matrix (see also the ADR and `CLAUDE.md` Sales Ops Routing):

| Role set | Visible workspaces | Default |
| --- | --- | --- |
| `['admin']` | tatico, operacional, cadastros | `/tatico/dashboard` |
| `['seller']` | meus-dados | `/meus-dados/vendedores` |
| `['finder']` | meus-dados | `/meus-dados/finders` |
| `['admin','seller','finder']` | all four | `/tatico/dashboard` |
| `[]` | none | `/no-role` |

## Decisions carried in from the front-door gate

- "Team" stays derived from the Hub workspace owner/admin flag; no Hub product-config change.
- "Meus dados" reuses existing panels; no net-new profile screen.
- "Meus dados" follows personal roles (team-only users do not see it).
- Frontend visibility only; backend/RLS remains authoritative.

## Execution note (honest record)

Ran the wave `--serial` rather than worktree-parallel.
`nexo-wave-exec.sh` hardcodes `git switch main` while this repo's trunk is `master`, and fresh git worktrees in this pnpm monorepo lack `node_modules` (each would need a full install), so parallel worktree builds were impractical for a 2-slice wave.
Execute-Verify separation was preserved: each slice's Execute agent and Verify agent were distinct fresh agents, plus a separate integration wave-verify.

## Mutation testing

Not run: no Stryker / mutation-testing tooling is configured in this repo.
Adding it is out of scope for this feature (infra change).
Flagged so the coverage-quality gate is not silently assumed.

## Manual verification outstanding

See `AUDIT.md` in this run dir - live-UI eyeballing that unit tests cannot assert (name renders correctly, switcher gone, per-role workspace lists, "Meus dados" panels), plus the ready-to-ship note.
