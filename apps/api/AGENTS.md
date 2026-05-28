# apps/api — agent guide

## Stack

Hono 4 + Drizzle ORM + Postgres (postgres-js) + Clerk Backend SDK + Zod validation.

## Layout

```
src/
├── server.ts              # entrypoint: app composition + serve
├── env.ts                 # zod-validated process.env
├── db/
│   ├── client.ts          # postgres-js connection + drizzle wrapper
│   └── schema.ts          # Drizzle tables — extend per domain
├── middleware/
│   ├── auth.ts            # Clerk JWT → c.set('userId', 'orgId')
│   ├── cors.ts            # cors with env.CORS_ORIGIN
│   └── error.ts           # HTTPException + 500 catcher
├── routes/
│   └── health.ts          # / liveness probe
└── domains/
    └── {name}/
        ├── routes.ts      # Hono router
        └── service.ts     # zod schemas + business logic + drizzle queries
```

## Rules

1. **Domain pattern.** New endpoints go in `src/domains/<name>/{routes,service}.ts`. Routes call services; services do drizzle + zod. No business logic in routes.
2. **org_id filtering.** Every query MUST filter by `eq(table.orgId, c.get('orgId'))`. Mutations also include `eq(table.id, id)` for safety.
3. **Auth.** Use `c.get('userId')` / `c.get('orgId')` from auth middleware. Never trust request body for these.
4. **Zod everywhere.** Input validation via `@hono/zod-validator` at the route boundary. Internal service functions receive parsed objects.
5. **Drizzle.** Schemas in `db/schema.ts`. Generate migrations with `pnpm db:generate`. Apply with `pnpm db:migrate`.

## Commands

```bash
pnpm dev              # tsx watch
pnpm build            # tsc + tsc-alias
pnpm type-check       # tsc --noEmit
pnpm db:generate      # drizzle-kit generate
pnpm db:migrate       # apply migrations
pnpm db:studio        # drizzle-kit web UI
```
