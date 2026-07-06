# apps/api - agent guide

## Stack

Hono 4, Drizzle ORM, Postgres through postgres-js, FXL Hub SDK, and Zod validation.

## Layout

```text
src/
├── server.ts              # entrypoint: app composition + serve
├── env.ts                 # zod-validated process.env
├── db/
│   ├── client.ts          # postgres-js connection + drizzle wrapper
│   └── schema.ts          # Drizzle tables
├── middleware/
│   ├── app-auth.ts        # Hub auth and BFF setup
│   ├── auth.ts            # tenant context helpers
│   ├── cors.ts            # cors with env.CORS_ORIGIN
│   └── error.ts           # HTTPException + 500 catcher
├── routes/
│   └── health.ts          # liveness probe
└── domains/
    └── {name}/
        ├── routes.ts      # Hono router
        └── service.ts     # zod schemas, business logic, drizzle queries
```

## Rules

1. New endpoints go in `src/domains/<name>/{routes,service}.ts`.
2. Routes call services, and services own drizzle plus zod-aware business rules.
3. Every tenant query must filter by `eq(table.orgId, c.get('orgId'))`.
4. Mutations must also include `eq(table.id, id)` or the equivalent tenant-safe key.
5. Use `c.get('userId')`, `c.get('orgId')`, and `c.get('hubAuth')` from auth middleware.
6. Never trust tenant or account identifiers from request bodies.
7. Feature gates check Hub entitlement modules from verified claims.
8. Generate migrations with `pnpm db:generate` and apply with `pnpm db:migrate`.

## Commands

```bash
pnpm dev
pnpm build
pnpm type-check
pnpm test
pnpm test:integration
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```
