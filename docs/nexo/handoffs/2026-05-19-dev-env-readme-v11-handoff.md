# Handoff — fxl-template v1.1 (dev-env + README)

**Date:** 2026-05-19
**Branch:** `main` (local only)
**Final commit:** `15f79dd` (+ polish commit immediately after)

## What was built

A 3-level environment model (local / staging / prod) plus a root `README.md` so the CTO can onboard new developers without exposing them to staging credentials.

### Files added

- `apps/api/.env.dev.example`
- `apps/web/.env.dev.example`
- `apps/site/.env.dev.example`
- `apps/mobile/.env.dev.example`
- `scripts/setup-dev.sh`
- `README.md` (root)
- `docs/superpowers/specs/2026-05-19-dev-env-readme-design.md`

### Files modified

- `scripts/init-from-template.sh` — prefers `.env.dev.example`, falls back to `.env.example`; updated "Next steps" trailer
- `Makefile` — `make setup` target
- `CLAUDE.md` — added Environments section
- `docs/template-usage.md` — first-time CTO setup callout, new-dev onboarding flow

## Environment model (locked decisions)

```
LOCAL                          STAGING                       PRODUCTION
─────                          ───────                       ──────────
Clerk:  shared "FXL Local      Clerk:  this project's        Clerk:  this project's
        Sandbox" Clerk app             Clerk app's                    Clerk app's
        (1 app, all 20+               "Development" instance         "Production" instance
        FXL projects)                  (CTO + leads only)             (real users)
Postgres: local Docker         Postgres: Coolify staging      Postgres: Coolify prod
Secrets: .env.dev.example      Secrets: Infisical (staging)   Secrets: Infisical (prod)
         (committed)
Who:    all devs               Who:    CTO + leads            Who:    CTO + ops only
```

## Action required (CTO, one-time)

The `.env.dev.example` files currently contain placeholder Clerk keys (`pk_test_FXL_LOCAL_SANDBOX_REPLACE_ME` / `sk_test_FXL_LOCAL_SANDBOX_REPLACE_ME`). To activate the dev environment for everyone:

1. Go to https://dashboard.clerk.com → New application → name it **"FXL Local Sandbox"**
2. Open Development instance → API Keys → copy publishable + secret keys
3. In your local `fxl-template` clone:
   ```bash
   PK="pk_test_REAL_VALUE_HERE"
   SK="sk_test_REAL_VALUE_HERE"
   find apps -name '.env.dev.example' -exec sed -i '' "s|pk_test_FXL_LOCAL_SANDBOX_REPLACE_ME|$PK|g" {} +
   find apps -name '.env.dev.example' -exec sed -i '' "s|sk_test_FXL_LOCAL_SANDBOX_REPLACE_ME|$SK|g" {} +
   git commit -am "config: wire FXL Local Sandbox Clerk keys into template"
   ```
4. Push to your template remote when ready.

From this point on, every new project from the template + every new dev onboarded with `make setup` gets working Clerk dev auth automatically.

## Verified end-to-end

- Cloned template to `/tmp`, ran init-from-template.sh demo-app "Demo App" demo_app → 4 `.env` files created from `.env.dev.example` with tokens substituted (DATABASE_URL=`postgresql://...demo_app`, ports, app name)
- 0 unresolved `__APP_*__` tokens
- `pnpm install` 3s clean
- `pnpm -r type-check` green for all 5 workspace packages
- `setup-dev.sh` idempotent: re-run skipped existing `.env` files, fired the sandbox-placeholder warning correctly, completed install in 1.2s

## Resume tips for future sessions

- Spec: `docs/superpowers/specs/2026-05-19-dev-env-readme-design.md`
- v1.0 baseline handoff: `docs/nexo/handoffs/2026-05-19-fxl-template-v1-handoff.md`
- `git log --oneline` shows the full milestone history
- README is intentionally long — it's the entrypoint for everyone, not a reference doc

## Suggested next steps

1. **Do the one-time CTO Clerk setup** (see "Action required" above)
2. Drop in mobile asset placeholders (`apps/mobile/assets/icon.png`, `adaptive-icon.png`) — currently warned by Expo
3. Wire `scripts/perf-audit.mjs` to real FXL rules (port from `1-fxl-financeiro`)
4. Add a Vitest smoke test for `/health` and a Playwright sign-in test for `apps/web`
5. When ready: `gh repo create fxl/fxl-template --private --source . --push` (push is your call)
