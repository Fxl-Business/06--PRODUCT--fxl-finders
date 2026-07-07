---
id: 01-optimistic-product-create
milestone: null
status: done
depends_on: []
files_modified: [apps/web/src/admin/products/useProducts.ts, apps/web/src/admin/products/__tests__/useProducts.test.ts, package.json]
acceptance: "given Admin Products is showing a product list, when a valid product is submitted, then the row appears immediately, is replaced by the server row on success, and is rolled back on failure"
---

# Slice 01 - Optimistic Product Create

## Goal

Make Admin Products creation feel instant by writing an optimistic product row into every relevant products-list cache before the POST completes.

## Design

Add a focused test suite around `useCreateProduct`.
Use TanStack Query `onMutate`, `onSuccess`, `onError`, and `onSettled` in `apps/web/src/admin/products/useProducts.ts`.
Generate a temporary product list row from the submitted body and the cached app list.
Insert that row into product list query caches whose app filter matches the submitted `appId`.
Store previous cache snapshots in the mutation context.
Replace the temporary row with the server product on success.
Restore the previous cache snapshots on failure.
Invalidate the admin product queries after settlement to preserve existing server reconciliation.

## Test Contract

Run `pnpm --filter @fxl-sales/web test -- src/admin/products/__tests__/useProducts.test.ts`.
The first red test must fail because `useCreateProduct` does not yet write to the product list cache while the mutation is pending.
The green result must show the optimistic row immediately, server reconciliation on success, rollback on failure, and product query invalidation after settlement.
Gate 2 also requires root `test` and `type-check` to build shared workspace packages first so API imports resolve in a fresh worktree.
