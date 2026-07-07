# Autopilot audit - run 20260707-1807-optimistic-product-create

## Scope follow-up - all application create flows

- [ ] DECIDE: whether to extend optimistic updates to every create and save mutation in the web app.
- PARKED: the approved slice covered Admin Products creation first.
- WHY: other flows such as apps, sellers, finder links, and sales operations have different detail caches, rollback needs, and error UX, so applying one generic behavior across all of them would guess past the WHAT boundary.
