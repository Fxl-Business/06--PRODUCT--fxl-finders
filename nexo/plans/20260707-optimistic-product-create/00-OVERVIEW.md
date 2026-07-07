# Optimistic Product Create

## Frame

The application should show newly created records immediately instead of waiting for the create request and list refetch to complete.
The first approved slice targets Admin Products because the user named product creation as the example workflow.

## Acceptance

Given the Admin Products list is already loaded, when an admin submits a valid new product, then the new row appears in the list immediately before the refetch completes.
Given the create request succeeds, when the server returns the persisted product, then the temporary optimistic row is replaced by the server row.
Given the create request fails, when the mutation rejects, then the temporary optimistic row is removed and the existing list is restored.

## Scope Limits

This slice changes only the Admin Products create flow.
It does not add new API endpoints or database fields.
It keeps TanStack Query as the owner of server state.
It keeps the existing invalidate-after-mutation behavior so server truth still wins after settlement.

## Slice Index

| Slice | Status | Wave | Acceptance |
|---|---|---:|---|
| 01-optimistic-product-create | done | 1 | Product create appears immediately, reconciles on success, and rolls back on failure. |
