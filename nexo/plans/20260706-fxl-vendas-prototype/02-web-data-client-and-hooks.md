---
id: 02-web-data-client-and-hooks
milestone: 20260706-fxl-vendas-prototype
status: done
depends_on: [01-sales-operations-api]
files_modified: [apps/web/src/lib/api-client.ts, apps/web/src/sales-ops/types.ts, apps/web/src/sales-ops/api.ts, apps/web/src/sales-ops/hooks.ts, apps/web/src/sales-ops/__tests__/calculations.test.ts]
acceptance: "Given the sales operations API exists, when the web app queries and mutates sales operations data, then it uses typed API clients and TanStack Query invalidation rather than local mock arrays."
---

# Slice 02 - Web data client and hooks

## Scope

Add typed web client functions and hooks for sales operations.
Keep auth token lookup through the existing `useAccessToken` helper.
Return arrays through guarded selects so malformed responses cannot crash list pages.

## Test Contract

Write failing web tests first in `apps/web/src/sales-ops/__tests__/calculations.test.ts`.
The oracle command is `pnpm --filter @fxl-sales/web test -- src/sales-ops/__tests__/calculations.test.ts`.

## Expected Behavior

Hooks expose loading, empty, loaded, and mutation states.
Mutations invalidate dashboard, sales, clients, products, people, commissions, payables, and settings query keys when their underlying data could change.
Client-side helpers format money, initials, status labels, and role-scoped lists from server data only.

## Out Of Scope

Do not add a second fetch helper.
Do not bypass `apiFetch`.
Do not introduce frontend-only persistence.
