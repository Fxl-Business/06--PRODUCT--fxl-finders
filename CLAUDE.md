# Fxl Finders

Project bootstrapped from `fxl-template` — the FXL canonical monorepo scaffold. After init, fill in stack-specific details and remove this line.

## Architecture

- **Monorepo**: pnpm workspaces — `apps/web`, `apps/api`, `apps/site`, `apps/mobile` (standalone), `packages/shared-types`, `packages/shared-utils`
- **Frontend**: React 18 + Vite + TypeScript + Tailwind + shadcn/ui + TanStack Query + React Router v6
- **Backend**: Hono + Drizzle ORM + PostgreSQL + Clerk Backend SDK
- **Landing**: Next.js 15 + Tailwind v4
- **Mobile**: Expo Router + React Native + NativeWind + Clerk Expo (standalone — not in pnpm workspace)
- **Auth**: Clerk organizations — JWT carries org_id, backend validates
- **Data flow**: React → api-client.ts → Hono → PostgreSQL (Drizzle). Frontend NEVER calls DB directly.
- **Deploy**: Hetzner VPS via Coolify (API), Vercel (web + site)
- **i18n**: react-i18next — PT-BR primary, EN secondary

## Commands

```bash
make setup        # One-shot bootstrap (preflight + rename + .env + install + db).
                  # Auto-detects new-project vs new-dev mode.
make setup-no-db  # Same as setup but skips Docker (use when Docker isn't running)
make              # Interactive selector — pick 1) api  2) web  3) mobile  4) site
make front        # Frontend only (port 8006)
make site         # Landing only (port 4006)
make back         # Backend only (port 3006)
make mobile       # Mobile (Expo dev server, standalone)
make install      # pnpm install
make doctor       # FXL health check
make check        # lint + type-check
```

## Rules — FXL contract (inherited from template)

### Data & Auth
- Every table has `org_id text NOT NULL` with RLS policy
- Backend extracts org_id from Clerk JWT: `payload.org_id ?? payload.sub`
- All queries filter by org_id — never trust client-provided org_id
- All mutations include `eq(table.id, id)` AND `eq(table.orgId, orgId)`
- `DATABASE_URL` is backend-only — never prefix with `VITE_`
- Admin endpoints bypass org_id filtering (cross-org visibility)

### Code Style
- Named exports only — no default exports
- Functional components only — no class components
- Strict TypeScript — no `any`, use `unknown` + type guards
- Array hooks use `select: (data) => Array.isArray(data) ? data : []`
- Query invalidation: `invalidateQueries()` — never `resetQueries()`
- Every mutation hook MUST invalidate every queryKey whose underlying data the server-side handler could change

### UI Identifiers (no raw Clerk IDs)
- NEVER render a raw Clerk identifier (`user_*`, `org_*`) in user-facing UI
- The API boundary resolves names via `resolveActors` / `resolveOrgs`
- Frontend components render via `userLabel` / `orgLabel` helpers
- Raw-ID fallback uses `font-mono text-xs text-muted-foreground`

### Loading States (mandatory)
- `isLoading === true` → skeleton (never empty state, never content)
- `!isLoading && empty` → empty state ("Sem dados")
- `!isLoading && data` → content
- Use `KPICard` for all metric displays with `title`, `value`, `icon`, `isLoading`, `colorScheme`

### API Pattern (domain-based)
- `apps/api/src/domains/{name}/routes.ts` — Hono router with typed Variables
- `apps/api/src/domains/{name}/service.ts` — Zod schemas + business logic + Drizzle queries
- Routes extract orgId/userId from context, pass to service

### Performance Budget
- Every commit runs `pnpm run perf:audit` via `.husky/pre-commit`
- `--no-verify` is forbidden. To bypass: `Perf-Audit-Bypass: <reason>` trailer + tracked follow-up

## Environments

3-level model — full details in root `README.md`.

| Level | Clerk | Postgres | Secrets | Who |
|---|---|---|---|---|
| **local** | Shared "FXL Local Sandbox" Clerk app (one across all 20+ FXL projects) | Local Docker (`make db-up`) | `.env.dev.example` → `.env` (committed dev keys) | All devs |
| **staging** | This project's Clerk app, "Development" instance | Coolify staging DB | Infisical `staging` env | CTO + leads |
| **production** | This project's Clerk app, "Production" instance | Coolify prod DB | Infisical `prod` env | CTO + ops |

New devs onboard with `make setup` (copies dev defaults, runs `pnpm install`). They never see staging or prod credentials.

## Template artifacts

This project was scaffolded from `fxl-template` v1.0.0. To check what's still a placeholder:

```bash
grep -r '__APP_' . --include='*.md' --include='*.ts' --include='*.tsx' --include='*.json' --include='*.yaml' --include='*.yml' --include='Makefile'
```

If any matches remain, the init-from-template script missed them — patch by hand and report to the template repo.
