# Autopilot Audit - 20260706-1735-hub-only-removal

## Operator Actions

- [ ] Register or rotate the FXL Hub client secret for `product.fxl-sales`.
- [ ] Set `FXL_HUB_SECRET_KEY` in API runtime envs.
- [ ] Provision Hub workspaces with preserved existing org ids.
- [ ] Invite members through Hub.
- [ ] Seed day-one `sales.core` entitlements before first Hub login.
- [ ] Set production Hub redirect URI to the API `/auth/callback` URL.

## Local Notes

- [x] Created the local `fxl_sales` database in the running Docker Postgres container.
- [x] Integration migrations created or reused the `fxl_sales_*` roles.
- [x] The old exact product identifier sweep returned no matches in tracked source outside ignored dependency/build folders.
- [x] The retired auth provider sweep returned no matches in tracked source outside ignored dependency/build folders.
- [x] Ignored local API env values were cleaned to Hub-only `fxl_sales` values.
- [x] Mobile lint runs with `--no-cache` to avoid generated absolute-path cache files.
