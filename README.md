# fxl-template

The canonical FXL monorepo scaffold. One `make setup` and you have a 4-app stack — API, Web, Site, Mobile — wired against the FXL contract, booting to a real layout, ready to be configured.

This README has two audiences:

- **CTO / project lead** starting a new project → § [Use as a template](#use-as-a-template-cto--project-lead)
- **New developer** joining an existing project → § [Onboard as a new dev](#onboard-as-a-new-dev-existing-project)

Both run the same `make setup` — the script auto-detects which mode applies.

If you want the design history, see `docs/superpowers/specs/`. Per-app coding rules live in `apps/*/AGENTS.md`. The FXL contract lives in `CLAUDE.md`.

---

## Before you run setup

The setup script does a preflight check and will exit with a clear error if any of these is missing. Get the green checks first:

### 1. Install the toolchain

| Tool | Why | Minimum |
|---|---|---|
| **Node.js** | All apps | 20 LTS |
| **pnpm** | Workspace manager | 9 |
| **Docker Desktop** | Local Postgres (`make db-up`) | 4.x |
| **git** | Source control | 2.x |
| **Xcode** | iOS builds (mobile only) | 15.x |
| **Android Studio** | Android builds (mobile only) | Hedgehog+ |

On macOS:

```bash
brew install node pnpm git
# Docker Desktop:    https://www.docker.com/products/docker-desktop
# Xcode:             App Store (only if you'll build iOS)
# Android Studio:    https://developer.android.com/studio (only if you'll build Android)
```

### 2. Start Docker Desktop

The setup script will refuse to continue if the Docker daemon isn't running (and you didn't pass `--no-db`). Open Docker Desktop and wait for the whale icon to settle before running `make setup`.

If you're on a machine without Docker temporarily (e.g., reviewing the code only), use `make setup-no-db` — it skips the Postgres start but does everything else.

### 3. Decide on your project identity (CTO new-project flow only)

The setup script will prompt for these — or you can pass them as positional args. Skip if you're a dev joining an existing project.

| Field | Format | Example |
|---|---|---|
| **slug** | lowercase kebab-case, starts with letter | `fxl-financeiro` |
| **name** | display name (free text) | `FXL Financeiro` |
| **db** | lowercase snake_case, starts with letter | `fxl_financeiro` |
| **project number** | integer 0–99 (FXL convention — derives all ports) | `3` |

The slug becomes the pnpm scope (`@<slug>/web`, `@<slug>/api`, …), the db name becomes `DATABASE_URL`'s database, and the name appears in titles, hero copy, etc.

#### Project numbers → automatic port assignment

FXL gives every project a number (0–99). The setup script uses it to derive non-overlapping ports across all 4 apps, so you can run multiple projects simultaneously without port collisions:

| App | Formula | Project 0 | Project 3 | Project 17 |
|---|---|---|---|---|
| api | `3000 + N` | 3000 | **3003** | 3017 |
| web | `8000 + N` | 8000 | **8003** | 8017 |
| site | `4000 + N` | 4000 | **4003** | 4017 |
| db (host port) | `5000 + N` | 5000 | **5003** | 5017 |

If your cwd dirname starts with a number (e.g., `3-fxl-financeiro`), setup picks that as the default. Press Enter at the project-number prompt to keep stock defaults (3000 / 5173 / 3001 / 5432).

### 4. (Optional) Get the FXL Local Sandbox Clerk keys

You only need to think about this if:

- You're the CTO and **this is your first project from the template** — you'll do a one-time Clerk Local Sandbox app creation. See [`docs/template-usage.md` → First-time CTO setup](docs/template-usage.md#first-time-cto-setup-fxl-local-sandbox-clerk-app).
- You're joining a team that hasn't done that one-time setup yet — ask your CTO before running `make setup`.

Otherwise the template ships with the FXL Local Sandbox keys already wired into `.env.dev.example`, and `make setup` will copy them to `.env` for you. The shared sandbox is free, multi-tenant, and good for daily work.

---

## Use as a template (CTO / project lead)

You're starting a brand-new FXL project.

```bash
# 1. Clone the template into your new project directory
git clone <fxl-template-url> my-new-project
cd my-new-project

# 2. One-shot setup (interactive — prompts for slug, name, db)
make setup

#    or, non-interactive:
bash scripts/setup.sh my-new-project "My New Project" my_new_project

# 3. Run an app
make            # interactive selector: 1) api  2) web  3) mobile  4) site
```

What `make setup` does in new-project mode:

1. **Preflight** — checks Node 20+, pnpm 9+, Docker daemon, git
2. **Identity** — prompts for slug / name / db (with defaults derived from the cwd dirname)
3. **Rename** — substitutes `__APP_*__` placeholders across the tree
4. **Env files** — copies `apps/*/.env.dev.example` → `apps/*/.env`
5. **Install** — `pnpm install` at root + `pnpm install` in `apps/mobile` (standalone scope)
6. **Database** — `docker compose up db -d` boots Postgres on `:5432` with your db name
7. **Fresh git** — wipes the template's `.git` and runs `git init` so your new project starts with a clean history. Make your first commit when ready.

After this, the project is ready. Everything else (Sentry, Resend, Infisical, Coolify, Clerk prod) gets wired later, per-environment.

> Pass `--keep-git` if you're testing the template repo itself and want to preserve its history (rare).

---

## Onboard as a new dev (existing project)

A teammate or your CTO has already created a project from this template. You're joining the team.

```bash
# 1. Clone the project
git clone <project repo> my-project
cd my-project

# 2. One-shot setup (no prompts — there's nothing to rename)
make setup
```

That's literally it. `make setup` detects this is an already-renamed project, skips the rename, and just does preflight + .env scaffolding + install + db boot.

After it finishes you should see:

- **api** → `http://localhost:3000/health` returns `{ok: true, ...}`
- **web** → `http://localhost:5173` shows the Clerk sign-in (sign up with your work email — you're on the shared FXL Local Sandbox)
- **site** → `http://localhost:3001` shows the landing page
- **mobile** → `make mobile` opens Expo dev tools; press `i` for iOS Simulator or scan the QR with Expo Go

You should **never** need staging or production credentials to do daily work. If you think you do, talk to your CTO first.

---

## Environments

3 levels. Devs only ever interact with `local`. Staging and prod are CTO + leads.

| Level | Clerk | Postgres | Secrets distribution | Who has access |
|---|---|---|---|---|
| **local** | Shared **FXL Local Sandbox** Clerk app (ONE app across all 20+ FXL projects, free tier) | Local Docker (`make db-up`) | `.env.dev.example` files are committed; `make setup` copies them to `.env` | All developers |
| **staging** | The project's own Clerk app, **Development** instance | Coolify staging Postgres | Infisical `staging` env | CTO + leads only |
| **production** | The project's own Clerk app, **Production** instance | Coolify prod Postgres | Infisical `prod` env (Coolify pulls from here on deploy) | CTO + ops only |

### Why this works

- **One shared sandbox** across 20+ FXL projects keeps the Clerk dashboard manageable. Devs sign in with their personal email; the shared sandbox doesn't host real users.
- **Local Docker Postgres** gives every dev a private, offline-capable DB. Destructive migrations don't affect anyone else.
- **Committed dev secrets** is safe specifically because the FXL Local Sandbox has no real users or data. Rotating the sandbox key takes one find-and-replace + git commit and propagates to every project on next clone.
- **Infisical for staging/prod** is the FXL canonical (see `docs/superpowers/specs/` for context). The dev role never gets staging or prod credentials.

### Pointing a local app at staging (one-off testing)

If a dev needs to reproduce a staging-only bug:

1. Get a temporary staging `.env` snippet from the CTO (delivered via Infisical share or 1:1).
2. Drop it into `apps/<app>/.env.local` (overrides `.env`, gitignored).
3. Run the app normally — the API loads `.env.local` on top of `.env` with override.
4. Delete `.env.local` when done.

---

## Getting API keys

| Key | Local dev | Staging | Production |
|---|---|---|---|
| **Clerk publishable** (`*_CLERK_PUBLISHABLE_KEY`) | Pre-filled (FXL Local Sandbox) | Infisical | Infisical |
| **Clerk secret** (`CLERK_SECRET_KEY`) | Pre-filled (FXL Local Sandbox) | Infisical | Infisical |
| **DATABASE_URL** | Localhost via docker-compose | Coolify-injected | Coolify-injected |
| **SENTRY_DSN** | Empty (no error reporting in dev) | Infisical | Infisical |
| **RESEND_API_KEY** | Empty (no email send in dev) | Infisical | Infisical |
| **VITE_ANALYTICS / NEXT_PUBLIC_VERCEL_ANALYTICS** | Disabled | Enabled | Enabled |

If `apps/*/.env` still contains `FXL_LOCAL_SANDBOX_REPLACE_ME` after `make setup`, the FXL Local Sandbox keys haven't been wired into this template repo yet. Ask the CTO to follow [`docs/template-usage.md` → First-time CTO setup](docs/template-usage.md#first-time-cto-setup-fxl-local-sandbox-clerk-app).

---

## Running the apps

```bash
make              # interactive selector (1=api, 2=web, 3=mobile, 4=site)
make back         # api    — http://localhost:3000
make front        # web    — http://localhost:5173
make site         # site   — http://localhost:3001
make mobile       # mobile — Expo dev server (cd apps/mobile)

make db-up        # start Postgres
make db-down      # stop Postgres
make db-reset     # destroy volume + re-create + migrate
make migrate      # apply Drizzle migrations

make install      # pnpm install at root
make setup        # full bootstrap (preflight + rename + .env + install + db)
make setup-no-db  # same as setup but skip Docker (preflight + rename + .env + install)
make build        # build shared-types + shared-utils + api + web
make check        # lint + type-check
make doctor       # full FXL health check (used in CI)

make help         # show all targets
```

---

## Common issues

**"docker daemon isn't running" during setup.** → Open Docker Desktop, wait for the whale icon to settle, retry `make setup`. Or use `make setup-no-db` to skip the Postgres start.

**"node X found, need >= 20" during setup.** → Upgrade Node: `brew upgrade node`, or use `nvm install 20 && nvm use 20`.

**"pnpm not found" during setup.** → `npm install -g pnpm`, or enable corepack: `corepack enable && corepack prepare pnpm@latest --activate`.

**Clerk redirects in a loop.** The publishable key is wrong or empty. → Check `apps/web/.env`; if it contains `FXL_LOCAL_SANDBOX_REPLACE_ME`, ask CTO for the real sandbox keys.

**`Cannot find module 'workspace:*'`.** You ran `pnpm install` inside an app dir instead of root. → `cd` back to the project root and run `pnpm install` there. Then for mobile, `cd apps/mobile && pnpm install` (mobile is a separate pnpm scope on purpose).

**`apps/mobile` complains about React versions.** Mobile uses React 19.1 (Expo / RN) while `apps/web` uses React 18. They live in separate pnpm scopes for this reason. → Always install mobile from `apps/mobile/`, not from root.

**TypeScript can't find `@<slug>/shared-types`.** The shared packages haven't been built. → `pnpm --filter @<slug>/shared-types build` and `pnpm --filter @<slug>/shared-utils build`. The `make build` target does both.

**`pnpm install` fails with peer-dep errors on @eslint/js.** Known benign warning (`@eslint/js@10` wants `eslint@^10`, project has `eslint@9`). pnpm proceeds anyway.

**Expo Go can't sign in via Clerk.** Expo Go has limited support for native Clerk flows. → Use a dev build: `cd apps/mobile && pnpm ios` (Xcode required) or `pnpm android`.

---

## Where to go next

- **`CLAUDE.md`** — the FXL contract (auth, data, code style, loading states, API patterns)
- **`apps/api/AGENTS.md`** — Hono domain-pattern rules, Drizzle conventions
- **`apps/web/AGENTS.md`** — UI rules (KPICard, loading triad, no raw Clerk IDs, i18n)
- **`apps/site/AGENTS.md`** — Next.js 15 server-component conventions, Tailwind v4
- **`apps/mobile/README.md`** — Expo standalone scope rationale, dev-build vs Expo Go
- **`docs/template-usage.md`** — placeholder rename details, first-time CTO setup
- **`docs/superpowers/specs/`** — design history (v1.0 baseline, v1.1 dev-env model)

---

## Contributing back to fxl-template

When a pattern proves itself in a downstream project, port it back here. Two reasons:

1. The next project benefits automatically on init.
2. Downstream maintenance gets easier when the template is the source of truth.

Open a PR with the change scoped to template-relevant files (configs, scripts, AGENTS.md). Don't backport business logic — that belongs in the project that needs it.
