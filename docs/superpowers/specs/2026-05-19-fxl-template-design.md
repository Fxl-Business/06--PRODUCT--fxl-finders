# FXL Template — Design Spec

**Date:** 2026-05-19
**Author:** Claude (via /nexo:add-feature)
**Project:** `fxl-template` — master scaffold for all future FXL client projects
**Path:** `/Users/cauetpinciara/Documents/fxl/projetos/internos/fxl-template/`
**Source of truth:** `/Users/cauetpinciara/Documents/fxl/projetos/clientes/1-fxl-financeiro/` (most evolved FXL project) + `/Users/cauetpinciara/Documents/fxl/projetos/internos/fxl/ecossistema/monorepo/` (FXL canonical standards)

---

## Goal

Replace ad-hoc copy-paste-rename of past FXL projects with a single parameterized monorepo template. After running `scripts/init-from-template.sh <slug> "<Name>" <db>`, the user gets a clean repo where all 4 apps (`web`, `api`, `site`, `mobile`) boot, render a real layout, and are wired against the FXL contract — without any business logic, migrations, or seeded data.

Past projects (`0-universal-laudos`, `3-gps-comercial`, `7-apice-laudos`) only have `apps/{api,web}`. The template's value is shipping the complete 4-app + 2-package skeleton with consistent tooling so future projects start at the same level as `1-fxl-financeiro`.

## Non-goals

- Real Drizzle schema, migrations, or seed data — `src/db/schema.ts` is empty; no migration files in `apps/api/drizzle/`
- TanStack Query data fetching in `apps/web` — `api-client.ts` exists but is unused; pages render empty states
- Sentry / Resend / R2 / Infisical runtime wiring — env keys present in `.env.example`, code paths are no-ops when keys are placeholder
- Playwright E2E test suite
- GitHub remote push (autopilot rule 11 forbids `git push`)
- Detailed README walkthroughs beyond `docs/template-usage.md`
- Multi-language documentation (PT-BR only in `CLAUDE.md` excerpts; code/comments in EN)

## Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Init strategy | Placeholder tokens (`fxl-finders`, `Fxl Finders`, `fxl_finders`, `3006`, `8006`) + `scripts/init-from-template.sh` | Zero ambiguity, auditable, easy for a future agent to follow |
| Scaffold depth | Full FXL contract pre-wired, layout-only (no data) | User clarification: each app must boot to a visible layout, but no migrations, no seed data, no API data routes |
| Mobile workspace | Outside pnpm workspace (`'!apps/mobile'`), own `pnpm-lock.yaml` | Matches source — Expo 54 / RN 0.81 / React 19.1 conflict with React 18 in `apps/web` |
| Git policy | `git init` + one atomic commit per phase, no remote push | Required by `.husky/pre-commit` (perf-audit gate); enables `git diff` between phases |
| Nexo wiring | Full — root `CLAUDE.md`, `.nexo/{config,manifest}.json`, `.planning/` skeleton, per-app `AGENTS.md`, `docs/nexo/handoffs/.gitkeep` | Every new project is immediately compatible with `/nexo:*` and `/gsd-*` |

## Architecture

```
fxl-template/
├── apps/
│   ├── api/             Hono + Drizzle skeleton (empty schema, no migrations)
│   ├── web/             Vite + React 18 + Tailwind + shadcn + Clerk shell
│   ├── site/            Next.js 15 + React 19 + Tailwind v4 landing
│   └── mobile/          Expo Router + RN + NativeWind + Clerk Expo (standalone)
├── packages/
│   ├── shared-types/    Env schemas, audit-actions tuple (empty), Drizzle row helpers
│   └── shared-utils/    Date/id/money helpers, theme tokens
├── .planning/           PROJECT.md, ROADMAP.md, STATE.md templates, perf-budget.yml
├── .nexo/               config.json + manifest.json (placeholders)
├── .husky/pre-commit    Runs `pnpm run perf:audit`
├── .github/workflows/   ci.yml (lint + type-check + fxl-doctor)
├── docs/
│   ├── template-usage.md
│   ├── superpowers/specs/2026-05-19-fxl-template-design.md (this file)
│   └── nexo/handoffs/.gitkeep
├── scripts/
│   ├── init-from-template.sh   Find/replace tokens, regenerate lockfile
│   └── perf-audit.mjs           Stub exits 0 until configured
├── CLAUDE.md            Root FXL contract rules with placeholders
├── Makefile             dev / front / site / back / mobile / install / build / ...
├── docker-compose.yml   Postgres 16-alpine + named volume
├── fxl-doctor.sh        CI health check
├── package.json         fxlContractVersion: "1.0", fxlAppId: "fxl-finders"
├── pnpm-workspace.yaml  apps/* excluding apps/mobile, packages/*
├── tsconfig.base.json   Strict NodeNext, project references
├── prettier.config.js
├── vercel.json          SPA rewrites for apps/web
├── .gitignore
└── .npmrc
```

## Placeholder tokens

The rename script does a literal find/replace across the tree (excluding `node_modules`, `dist`, `.git`):

| Token | Example value | Used in |
|---|---|---|
| `fxl-finders` | `fxl-financeiro` | pnpm scope `@fxl-finders/web`, `.nexo/config.json`, package names |
| `Fxl Finders` | `FXL Financeiro` | README, CLAUDE.md, page titles, hero copy |
| `fxl_finders` | `fxl_financeiro` | `docker-compose.yml`, `DATABASE_URL` |
| `3006` | `3000` | api server, docker-compose, `CORS_ORIGIN`, web `VITE_API_URL` |
| `8006` | `5173` | vite config, api `CORS_ORIGIN` |

Script signature: `scripts/init-from-template.sh <slug> "<Name>" <db> [--api-port 3000] [--web-port 5173] [--git-fresh]`. The `--git-fresh` flag wipes `.git/` and re-inits, otherwise the existing template git history is preserved.

## What each app renders on first `make dev`

### `apps/api` — http://localhost:3000

- `GET /health` returns `{ ok: true, version, env, timestamp }`
- Hono + `@hono/node-server`, `@hono/zod-validator` installed
- Drizzle wired: `drizzle.config.ts`, `src/db/client.ts` (postgres-js), `src/db/schema.ts` (empty exports placeholder)
- Middleware mounted but inert when env vars are placeholder: Clerk auth (passthrough), Sentry (no-op), CORS (allows `8006`)
- `Dockerfile` for Coolify deploy
- No domains, no migrations, no seed data

### `apps/web` — http://localhost:5173

```
┌────────────────────────────────────────────────────────────┐
│  [Logo Fxl Finders]                  [Org switcher] [👤]   │
├──────────┬─────────────────────────────────────────────────┤
│ Sidebar  │  Dashboard (empty state)                          │
│ • Home   │                                                   │
│ • Items  │  [icon] Sem dados ainda                           │
│ • Config │       Comece configurando suas integrações.       │
└──────────┴─────────────────────────────────────────────────┘
```

- 3 routes: `/`, `/items`, `/config` — each renders `<AppShell>` + `<EmptyState>`
- `<AppShell>` = `<Sidebar>` + `<TopBar>` (org switcher, user button from Clerk) + `<main>`
- Clerk: `<SignedOut>` → redirect to Clerk-hosted sign-in, `<SignedIn>` → app
- shadcn baseline: `Button`, `Card`, `Input`, `Label`, `Skeleton`, `KPICard`, `EmptyState`
- i18n: PT-BR primary, EN secondary — only navigation + empty-state strings
- `src/lib/api-client.ts` exists, exports `apiFetch` helper, unused by pages
- TanStack Query provider mounted at root, no queries in pages
- Tailwind tokens identical to `apps/site` (shared via `packages/shared-utils/src/theme.ts`)

### `apps/site` — http://localhost:3001

Landing page with real visible sections (placeholder copy):
- Hero: `Fxl Finders` headline + subhead + CTA "Acessar dashboard" → env-driven link
- Features: 3-column grid (lucide icons + 2-line descriptions)
- How it works: 4-step timeline
- Footer: links + copyright `Fxl Finders`
- Next.js 15 App Router + Tailwind v4 + shadcn-style `Button` only
- `@vercel/analytics` gated on `NEXT_PUBLIC_VERCEL_ANALYTICS=1`

### `apps/mobile` — Expo Router

- `(auth)/sign-in.tsx` — Clerk sign-in screen using `@clerk/clerk-expo`
- `(tabs)/_layout.tsx` — tab navigator after sign-in
- `(tabs)/index.tsx` — Home tab with 2 placeholder `KPICard` components (static numbers)
- `(tabs)/settings.tsx` — theme toggle + sign-out button
- NativeWind v4 + Tailwind tokens matching web
- DM Sans + Inter via `@expo-google-fonts`

## Shared visual language

- Tailwind primary/secondary/accent/muted tokens defined in `packages/shared-utils/src/theme.ts` and re-exported in each app's Tailwind config
- Geist Sans on `apps/web` + `apps/site` (`@fontsource-variable/geist`)
- DM Sans + Inter on `apps/mobile`
- Icons: `lucide-react` on `apps/web` + `apps/site`, `lucide-react-native` on `apps/mobile`

## FXL contract artifacts (verbatim from source where applicable)

- `package.json` has `fxlContractVersion: "1.0"` + `fxlAppId: "fxl-finders"`
- `.husky/pre-commit` runs `pnpm run perf:audit` (script is a stub that exits 0 in the template, real audit ships in client projects)
- `fxl-doctor.sh` runs `pnpm install` check + `pnpm run type-check` + `pnpm run lint` + workspace-version sanity
- `Makefile` targets: `dev`, `front`, `site`, `back`, `mobile`, `install`, `build`, `lint`, `type-check`, `check`, `migrate`, `db-up`, `db-down`, `db-reset`, `docker-up`, `docker-down`, `clean`, `help`
- `CLAUDE.md` includes Data & Auth, Code Style, Loading States, API Pattern, Admin & Audit, Performance Budget sections — with `Fxl Finders` placeholders for project-specific phrasing
- Per-app `AGENTS.md` follows the FXL `per-folder-agents-md` standard

## Phase plan (Token tier 2)

6 phases, ≤ 3 planner/executor agents at a time per nexo-orchestrator-rules.

| # | Phase | Verify-work success criterion |
|---|---|---|
| 1 | Monorepo foundation | `pnpm install` succeeds at root after running `init-from-template.sh demo-app "Demo App" demo_app`; `git log` shows initial commit |
| 2 | Shared packages | `pnpm -r type-check` passes for `shared-types` and `shared-utils` |
| 3 | `apps/api` Hono skeleton | `make back` boots; `curl localhost:3000/health` returns `{ok:true}` |
| 4 | `apps/web` Vite shell | `make front` boots; localhost:5173 shows Clerk sign-in; after sign-in (test instance) sidebar + 3 routes render empty states |
| 5 | `apps/site` Next.js landing | `make site` boots; localhost:3001 shows landing page with hero/features/timeline/footer |
| 6 | `apps/mobile` Expo skeleton | `cd apps/mobile && pnpm install && pnpm start` opens Expo dev server; QR code → sign-in screen on Expo Go |

**Phase 3.5 — Code review** after each verify-work: `/gsd-code-review N` + `/gsd-code-review-fix N --auto` (up to 3 retries). Surfaces FXL contract violations (no `any`, named exports only, KPICard contract, Loading States rules).

## Failure semantics

- Verify-work failure → halt autonomous run; append `{phase, step:"verify-work", reason, artifact}` to failure list; surface to user
- TSC errors are blockers for not-yet-executed phases
- Phase 1 MUST commit before any other phase starts (downstream `.husky/pre-commit` requires git + perf-audit script)
- Phase 6 (mobile) is highest risk — `pnpm-lock.yaml` is regenerated outside the workspace and React 19/18 mismatch is constrained by `pnpm.overrides`

## Open risks

1. **shadcn/ui CLI version**: `apps/web` uses `shadcn` v4. The CLI may have changed between source-project install and now. Phase 4 will pin to the version in source's `package.json` and skip `npx shadcn init`, copying component sources directly.
2. **Next.js + Tailwind v4**: source's `apps/site` uses Tailwind v4 (`@tailwindcss/postcss`). Phase 5 will mirror the source's `postcss.config.mjs` verbatim rather than re-derive it.
3. **Expo + pnpm hoisting**: source has `apps/mobile/pnpm-workspace.yaml` which makes mobile its own pnpm scope. Phase 6 will copy this exact pattern.
4. **`@fxl-business/support-sdk` private package**: source depends on this. The template will NOT include it — replaced by a local stub interface in `packages/shared-types/src/support.ts` to keep the template installable without private registry access.

## Spec self-review (2026-05-19)

- Placeholders scanned — all `__APP_*__` tokens are defined in the table.
- Internal consistency — phase verify criteria match deliverables in Section "What each app renders".
- Scope check — focused on one milestone (template v1.0). Six phases fit Tier 2.
- Ambiguity check — clarified: no migrations, no seed data, no TanStack queries in pages; api-client.ts exists but unused; Clerk login flow is wired but only to Clerk-hosted page (no custom sign-in component).
