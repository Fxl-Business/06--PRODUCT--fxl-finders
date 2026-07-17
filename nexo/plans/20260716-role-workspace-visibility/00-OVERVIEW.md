---
id: 20260716-role-workspace-visibility
milestone: v2.2.0
status: done
mode: autopilot
run: 20260716-role-workspace-visibility
---

# Role-driven workspace visibility + UTF-8 name fix

## Frame

Two changes land together on `master` (autopilot):

1. **Fix the garbled workspace/user name.**
The account switcher renders "Gestão FXL" as "GestÃ£o FXL".
Root cause: the Hub JWT payload is base64-decoded with `atob`, which reads the UTF-8 bytes as Latin-1.
This surfaces on every non-ASCII name.

2. **Replace the prototype "Nível de visualização" viewing-level switcher with real Hub-role-driven workspace visibility.**
The app already derives the full multi-role set from Hub claims (`profile.roles: AppRole[]`, `AppRole = 'admin' | 'seller' | 'finder'`).
Today a leftover switcher re-frames those roles as an ephemeral per-session "viewing level" and workspace visibility is nearly unfiltered (only `cadastros` is hidden from non-team).
The real product has 3 roles - team (`admin`), seller, finder - and a user can hold one or many.
"Team" is not a Hub product role; it is synthesized in-app from the Hub workspace `owner`/`admin` flag. That mapping stays (no Hub-side change).

## Acceptance

- Given a workspace named "Gestão FXL", when the account switcher and the sidebar user control render, then the name displays as "Gestão FXL" (no mojibake), and any other non-ASCII name round-trips correctly.
- Given a user with only `seller` or only `finder` (no team), when the app loads, then the only workspace is "Meus dados" and they land there by default; Tático/Operacional/Cadastros are not shown or reachable.
- Given a user with `admin` (team), when the app loads, then Tático, Operacional and Cadastros are shown; "Meus dados" is shown only if they also hold `seller` or `finder`.
- Given a user with team + seller/finder, when the app loads, then all four workspaces are visible.
- Given any user, when the app renders the header, then the "Nível de visualização" viewing-level switcher no longer exists.
- Given a user with zero recognized roles, when the app loads, then the existing `/no-role` behavior is unchanged.
- Given the legacy `/admin/*`, `/finder/*`, `/seller/*`, `/no-role` route trees, when this change lands, then they are unchanged.

## Scope Limits

- Frontend visibility only; backend/RLS remains authoritative. No API changes.
- No Hub product-config change; "team" stays derived from the Hub workspace owner/admin flag.
- "Meus dados" **reuses existing panels** (seller: Meu painel + comissões; finder: Meu painel + indicações). No net-new profile screen.
- Do not touch the legacy `/admin/*`, `/finder/*`, `/seller/*`, `/no-role` trees.
- Never render raw account/workspace ids; keep `userLabel`/`orgLabel` usage.
- The URL remains the single source of truth for the active Sales Ops workspace/page.

## Slice Index

| Slice | Status | Depends on | Wave | Acceptance |
| --- | --- | --- | --- | --- |
| 01-utf8-jwt-decode | done | [] | 1 | Non-ASCII names from Hub JWT claims render correctly (UTF-8, not Latin-1). |
| 02-role-driven-workspace-visibility | done | [] | 1 | Workspace visibility follows the Hub role set; seller/finder-only see only "Meus dados"; the viewing-level switcher is removed. |

Slices 01 and 02 touch disjoint files (`auth/*` vs `sales-ops/*`) and are parallel-safe.
