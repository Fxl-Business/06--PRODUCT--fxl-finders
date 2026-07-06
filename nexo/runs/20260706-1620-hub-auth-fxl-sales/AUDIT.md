# Autopilot audit - run 20260706-1620-hub-auth-fxl-sales

## Operator Actions

- [ ] Issue and inject the real `FXL_HUB_SECRET_KEY` for `product.fxl-sales`.
- [ ] Provision Hub workspaces with preserved existing org ids before product login.
- [ ] Seed day-one `sales.core` entitlements for every migrated workspace.
- [ ] Create or invite the corresponding Hub accounts and workspaces for admin-created sellers and approved finders.
- [ ] Set `FXL_HUB_REDIRECT_URI` in production to the registered product API callback URL, for example `https://api.example.com/auth/callback`.
- [ ] Browser visual verification could not run because this Codex session has no available in-app browser backend.
- [ ] Reopen the app at `http://localhost:8006` and inspect the auth shell after Hub envs are set.

## Local Smoke

- [x] `http://localhost:8006/` responds with the `Fxl Sales` app shell.
- [x] `http://localhost:3006/health` responds with `service: fxl-sales-api`.
