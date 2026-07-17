# Autopilot audit - run 20260716-role-workspace-visibility

No slices were parked. Everything that could be automated landed on `master` and passed Gate 2.
The items below are things only you can confirm (live UI) or that require a deliberate human step.

## Manual UI verification (visual, not unit-assertable)
Run the app (`master`) and eyeball with a real Hub login:
- [ ] TEST: the account switcher renders the workspace name correctly for a non-ASCII name (e.g. "Gestão FXL"), no "GestÃ£o FXL" mojibake, in both the header and the sidebar user control.
- [ ] TEST: the "Nível de visualização" viewing-level switcher is gone; the header shows a static identity block (avatar + name + role summary like "Equipe · Vendedor").
- [ ] TEST: a team (workspace owner/admin) user sees Tático, Operacional, Cadastros; if they also hold seller/finder, "Meus dados" appears as a fourth workspace.
- [ ] TEST: a seller-only user sees ONLY "Meus dados" and lands there; typing `/tatico/dashboard` redirects them to `/meus-dados/...`.
- [ ] TEST: a finder-only user sees ONLY "Meus dados" (Meu painel + Indicações).
- [ ] TEST: "Meus dados" shows the expected reused panels and the data is correctly scoped to that user (backend/RLS).

## Follow-ups (not blocking this run)
- [ ] Mutation testing is not configured (no Stryker); the feature-boundary coverage-quality gate was skipped. Decide whether to add mutation tooling later.

## Ready to ship
- [ ] `/nexo-ship` - milestone v2.2.0 has 2 slices merged to `master`, not yet cut/promoted. Autopilot never ships; promotion (master -> staging -> production) is a human Gate 3.
