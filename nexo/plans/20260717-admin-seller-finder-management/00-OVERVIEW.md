---
id: 20260717-admin-seller-finder-management
milestone: null
status: executing
mode: autopilot
run: 20260717-admin-seller-finder-management
---

# Admin seller and finder management

## Frame

Administrators need team management to live in the Cadastros workspace, while Tatico remains focused on KPI reporting.
Administrators also want an in-product directory of every Hub account with access to the active FXL Sales workspace and a safe way to link one account to one seller or finder record.

## Why

Creating and editing sellers or finders is master-data management rather than tactical analysis.
The current Tatico navigation mixes those responsibilities and makes the KPI workspace harder to understand.

Seller and finder records are currently operational people without a Hub account relationship.
That prevents personal dashboards from being scoped to the authenticated account through an explicit, tenant-safe mapping.

## Feature acceptance criteria

1. Given an administrator opens Tatico, when the workspace navigation renders, then Visao geral is its only page and no create or edit seller/finder control is available there.
2. Given an administrator opens Cadastros, when its navigation renders, then Vendedores and Finders are available with the existing list, create, and edit behavior.
3. Given a seller-only or finder-only user opens Meus dados, when personal navigation renders, then the existing Meu painel pages remain available and do not expose team create or edit controls.
4. Given an administrator opens the account-management page, when Hub directory data is available, then every account with FXL Sales access in the active workspace is listed by safe display fields, without exposing secrets or unrelated workspace members.
5. Given an administrator links an account to a seller or finder, when the mutation succeeds, then the tenant-scoped person record stores the account relationship and the directory immediately reflects the link.
6. Given an account is already linked to a person in the same tenant, when an administrator attempts to link it to another person, then the request is rejected without changing either record.
7. Given a non-admin calls any directory or account-linking endpoint, when authorization is evaluated, then the request is rejected.
8. Given a user from another workspace or an account not returned by the Hub product-access directory, when a link is attempted, then the request is rejected and no cross-tenant mapping is written.

## Scope limits

The feature keeps the current seller/finder person model and adds at most one Hub account relationship per person.
One person may continue to hold both seller and finder flags.
The feature does not create Hub accounts, invite users, grant product access, or edit Hub workspace membership.
The feature does not change legacy `/admin/*`, `/seller/*`, `/finder/*`, or `/no-role` routes.
The feature does not release or promote any commit beyond `master` under Autopilot.
Any missing Hub API or SDK contract required to enumerate product-access accounts is an external dependency and must be audited rather than replaced with an insecure direct database read or an audience-invalid token proxy.

## Planned slices

| Slice | Status | Intent | Dependency | Planned wave |
| --- | --- | --- | --- | --- |
| `01-cadastros-people-management` | `todo` | Move team seller and finder management from Tatico to Cadastros while preserving personal pages. | None | Wave 1 |
| `02-admin-account-linking` | `parked` | List FXL Sales accounts for the active workspace and link one account to one tenant-scoped person record. | External Hub product-access directory endpoints and published SDK contract | Wave 1 after unpark and recheck |

Only slices with an executable status participate in the run schedule.
The current run therefore executes slice 01 in Wave 1 and excludes slice 02 until its documented external unblock condition is satisfied and the plan is rechecked.
The raw `waves.sh` derivation assigns both dependency-free plans to Wave 1 because that helper does not filter by status, so the orchestrator must honor the `parked` status before dispatch.

## Gate 1

Skipped by the user's explicit Autopilot instruction on 2026-07-17.
