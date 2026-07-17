---
id: 02-admin-account-linking
milestone: null
status: parked
depends_on: []
files_modified: [apps/api/package.json, apps/api/src/db/schema.ts, apps/api/src/domains/sales-ops/account-linking-routes.ts, apps/api/src/domains/sales-ops/account-linking-service.ts, apps/api/src/domains/sales-ops/__tests__/account-linking-routes.test.ts, apps/api/src/domains/sales-ops/__tests__/account-linking-service.test.ts, apps/api/src/server.ts, apps/api/drizzle/0010_admin_account_linking.sql, apps/api/drizzle/meta/0010_snapshot.json, apps/api/drizzle/meta/_journal.json, apps/api/test/rls/sales-ops-account-linking.test.ts, apps/web/package.json, apps/web/src/sales-ops/SalesOpsApp.tsx, apps/web/src/sales-ops/navigation.ts, apps/web/src/sales-ops/types.ts, apps/web/src/sales-ops/accounts/api.ts, apps/web/src/sales-ops/accounts/hooks.ts, apps/web/src/sales-ops/accounts/AccountLinkingView.tsx, apps/web/src/sales-ops/accounts/__tests__/AccountLinkingView.test.tsx, apps/web/src/sales-ops/__tests__/navigation.test.ts, apps/web/src/sales-ops/__tests__/routing.test.tsx, apps/web/src/i18n/en.json, apps/web/src/i18n/pt-BR.json, pnpm-lock.yaml]
acceptance: "Given an authenticated administrator in an active FXL Sales workspace, when the administrator opens Cadastros > Usuarios, then the page lists only accounts with effective product.fxl-sales access in that workspace using safe display fields, supports tenant-safe link and unlink operations against seller or finder people, rejects duplicate, ineligible, cross-workspace, and non-admin mutations, and never forwards a product.fxl-sales token to a product.fxl-hub-only route or reads the Hub database directly."
---

# Slice 02 - Admin account linking

## Goal

Give an FXL Sales administrator a Cadastros page that lists every Hub account with effective `product.fxl-sales` access in the active workspace and links or unlinks that account from one tenant-scoped seller or finder person.

## Planning outcome

This slice is parked because FXL Sales does not currently have an audience-correct Hub contract for the required directory or mutation validation.

The external unblock is not represented in `depends_on` because that field contains only slice ids used to derive execution waves.
This slice remains outside every executable wave until the Hub product-access directory and published SDK contract described below are available.

The installed `@fxl-business/hub-sdk@1.2.0` exports BFF creation, product-token verification, browser token refresh, browser workspace switching, logout, checkout links, and management links.
It does not export a workspace-member directory, a product-access directory, or an account eligibility lookup.

Hub `GET /workspaces/:id/members` can return safe member fields and seats, but it is guarded with the `product.fxl-hub` audience.
Hub seat mutation routes use the same Hub-only audience.
FXL Sales receives `product.fxl-sales` access tokens, so forwarding one to those routes is audience-incompatible and must remain forbidden.

`FXL_HUB_SECRET_KEY` is the confidential OAuth client secret used during token exchange.
It is not authorization to Hub workspace APIs and must never be repurposed or exposed.

FXL Sales must not read the Hub database, import Hub database packages, mint a `product.fxl-hub` token, copy an internal Hub key, or infer account eligibility from email addresses or local rows.

## Exact external unblock contract

The Hub repository must ship and publish the following contract before this Sales slice moves from `parked` to `todo`.

### Audience-correct Hub endpoints

The Hub auth origin configured as `FXL_HUB_API_URL` must expose these endpoints:

```http
GET /me/product-access/accounts?limit=100&cursor=<opaque>
Authorization: Bearer <product access token>

GET /me/product-access/accounts/:accountId
Authorization: Bearer <product access token>
```

The list endpoint may accept only `limit` and `cursor` from the caller.
The resolve endpoint may accept only the target `accountId` path parameter.
Neither endpoint may accept a caller-supplied workspace id, product id, requester account id, audience, role, or entitlement.

The Hub must verify the bearer locally as a Hub-signed `at+jwt` with valid signature, issuer, type, and expiry.
The Hub must derive `requesterAccountId` from `sub`, `workspaceId` from the verified `workspaceId` claim, and `productId` from the single verified `aud` string.
The endpoint must reject an audience that is not a registered `product.*` id.

The Hub API behind the auth service must independently confirm that the requester is currently an owner or administrator of the derived workspace, or is a current Hub super-admin.
An ordinary workspace member, seller, or finder must receive `403` even if the token is otherwise valid.

The Hub must compute account eligibility from its current workspace membership, `product_access`, product app-role configuration, and the same effective-role rules used by token authorization.
An explicit product seat is authoritative for that account.
An explicit empty role set must suppress inherited product roles.
An owner, administrator, or super-admin member without an explicit seat receives the product's configured full-access roles.
An account is returned only when it has effective access to the exact product derived from the token audience.
An account from another workspace, a member without effective product access, an expired invite, and a revoked seat must not be returned.

The list response must use this exact safe shape and stable keyset pagination:

```ts
export type HubProductAccessAccount = {
  accountId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  workspaceRole: 'owner' | 'admin' | 'member';
  productRoles: string[];
};

export type HubProductAccessAccountsPage = {
  workspaceId: string;
  productId: string;
  accounts: HubProductAccessAccount[];
  nextCursor?: string;
};
```

Rows must be ordered by normalized `name ?? email`, then `accountId`, and the cursor must be opaque base64url data owned by Hub.
The response must not include `authProvider`, `authSubject`, password data, OAuth secrets, refresh tokens, internal keys, subscription payment data, or fields from another workspace.

The exact-account endpoint must return `{ workspaceId, productId, account }` with the same account projection.
It must return `404 { error: 'account_not_eligible' }` when the target does not currently have effective access in the derived workspace and product.
This exact lookup is the locked server-side validation used immediately before a Sales link mutation.

### Published SDK surface

The Hub must publish a new minor `@fxl-business/hub-sdk` release containing this server entry surface:

```ts
export type HubProductAccessClientOptions = {
  fetchImpl?: typeof fetch;
};

export type HubProductAccessClient = {
  listAccounts: (input: {
    accessToken: string;
    limit?: number;
    cursor?: string;
  }) => Promise<HubProductAccessAccountsPage>;
  getAccount: (input: {
    accessToken: string;
    accountId: string;
  }) => Promise<{
    workspaceId: string;
    productId: string;
    account: HubProductAccessAccount;
  }>;
};

export function createHubProductAccessClient(
  config: HubSdkConfig,
  options?: HubProductAccessClientOptions,
): HubProductAccessClient;
```

The client must call only the configured Hub auth origin and the two endpoints above.
It must send the bearer only in the `Authorization` header and must never send the SDK secret key.
It must require the response `productId` to equal `deriveAudience(config)` and reject a mismatched or malformed response without returning account data.
It must preserve Hub `401`, `403`, and `404 account_not_eligible` as typed errors and classify network or malformed response failures as unavailable.

### Hub acceptance tests required for unblock

The Hub change is complete only when its own test suite proves all of the following:

1. A `product.fxl-sales` token for a current workspace owner can list only the active workspace's effective FXL Sales accounts.
2. A valid token for `product.other` lists only `product.other` accounts and cannot choose `product.fxl-sales` through a query or body.
3. A seller or finder token receives `403` and the internal directory is not returned.
4. A missing, expired, foreign-issuer, wrong-type, or unsigned token receives `401` and causes no internal lookup.
5. A member without a Sales seat is excluded.
6. A member with a Sales seat and configured role is included with safe fields.
7. An owner or administrator without a seat inherits configured full-access roles and is included.
8. An explicit empty Sales seat on a privileged member overrides inheritance and excludes that account.
9. An account from another workspace and an account with only another product seat are excluded.
10. The exact-account endpoint returns the eligible account and returns `404 account_not_eligible` for every excluded case.
11. Neither endpoint serializes identity-provider fields or secrets.
12. The SDK client sends a product bearer, never the secret key, checks the response product id, and exposes the declared types from the published package.

The Hub repository owns these changes, tests, SDK version bump, package publication, and deployment.
FXL Sales must consume only the published package after those tests pass.

## Sales scope after unblock

This slice stores one optional Hub account relationship on the existing `sales_ops_people` record.
It does not create accounts, invite users, grant or revoke Hub membership, grant or revoke product access, edit Hub roles, or synchronize Hub profile fields into Sales.
It does not change the legacy `/admin/*`, `/seller/*`, `/finder/*`, or `/no-role` trees.
It does not change sale ownership or personal-dashboard query scoping in this slice.
It does not add background synchronization or delete links automatically when Hub access later changes.

## Data model and tenant uniqueness

Add `accountId: text('account_id')` as a nullable column on `salesOpsPeople`.
Do not add a cross-database foreign key.
Add a unique index on `(org_id, account_id)` named `sales_ops_people_org_account_id_unique`.
PostgreSQL permits multiple null values, so unlinked people remain valid.

The column gives each person at most one linked account.
The composite unique index gives each Hub account at most one linked person inside one Sales tenant.
The same Hub account may be linked in two different workspaces because the relationship is tenant-specific.

The existing `sales_ops_people` row-level security policies remain unchanged.
Every read, link, and unlink must run through `withTenant` or an equivalent transaction that calls `setTenantContext` first and filters both `orgId` and person id.

Generate the migration with this run-once command:

```bash
pnpm --filter @fxl-sales/api db:generate -- --name admin_account_linking
```

The generated files must be `apps/api/drizzle/0010_admin_account_linking.sql`, `apps/api/drizzle/meta/0010_snapshot.json`, and the generated journal update.
Do not hand-edit the generated migration or metadata.

## Sales API contract

Create a focused router mounted at `/api/v1/sales-ops/admin` after `appAuthMiddleware` and `requireAdmin`.
Do not place these endpoints under the generally authenticated Sales Ops router without `requireAdmin`.

Expose these endpoints:

```http
GET /api/v1/sales-ops/admin/accounts?limit=100&cursor=<opaque>
PUT /api/v1/sales-ops/admin/people/:personId/account
Content-Type: application/json
{ "accountId": "<hub-account-id>" }
DELETE /api/v1/sales-ops/admin/people/:personId/account
```

The list endpoint obtains the current request bearer from the already-verified authorization header and calls SDK `listAccounts`.
It must require the Hub response workspace id to equal `c.get('orgId')` and its product id to equal `product.fxl-sales` before joining local data.
It joins links only against `sales_ops_people` rows with the same `orgId` and returns this shape:

```ts
export type SalesOpsAccountDirectoryRow = {
  accountId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  workspaceRole: 'owner' | 'admin' | 'member';
  productRoles: string[];
  link: null | {
    personId: string;
    displayName: string;
    isSeller: boolean;
    isFinder: boolean;
  };
};
```

The list response is `{ accounts, nextCursor? }`.
Raw account ids may travel as opaque API identifiers but must never be rendered as customer-facing text.

The link endpoint validates a strict body containing only one non-empty `accountId`.
It calls SDK `getAccount` immediately before the local transaction.
It rejects a Hub `404` as `422 { error: 'account_not_eligible' }` and performs no write.
It rejects Hub scope mismatch as `502 { error: 'hub_scope_mismatch' }` and performs no write.
It returns `503 { error: 'hub_directory_unavailable' }` for a network or malformed Hub result and performs no write.

Inside one tenant transaction, linking an absent person returns `404 { error: 'person_not_found' }`.
Linking an account to a person that is not a seller or finder returns `422 { error: 'person_not_linkable' }`.
Linking the same person and account again is idempotent and returns the existing relationship.
Linking a person that already has another account returns `409 { error: 'person_already_linked' }`.
Linking an account already used by another person in the tenant returns `409 { error: 'account_already_linked' }` without changing either row.
The service must also map a PostgreSQL unique-constraint race to `account_already_linked` instead of returning `500`.

The unlink endpoint updates only the matching person inside `c.get('orgId')` and sets `accountId` to null.
Unlinking an absent person returns `404 person_not_found`.
Unlinking an already unlinked person is idempotent and returns the unchanged person.
Unlink does not revoke the account's Hub membership, seat, or product roles.

## Web behavior

Add the canonical admin-only route `/cadastros/usuarios` and the Cadastros navigation item `Usuarios`.
Do not expose that view in `meus-dados`, Tatico, or Operacional.
Role-forbidden direct navigation must continue resolving through the existing role-aware redirect logic.

Create `AccountLinkingView.tsx` as a focused component instead of adding the directory implementation to the existing large `SalesOpsApp.tsx` file.
The view must use TanStack Query infinite pagination with a page size of 100 and an explicit load-more control when `nextCursor` exists.
The account query key must live under `['sales-ops', 'admin', 'accounts']` and must be invalidated after link and unlink.
The existing Sales Ops bootstrap key must also be invalidated after either mutation because `people[].accountId` changes.

Loading renders skeleton rows.
An empty successful directory renders an empty state explaining that Hub access is managed in Hub.
An unavailable directory renders a non-destructive error state and no local account picker fallback.
Loaded rows show avatar or initials, `name ?? email`, email when a distinct name exists, workspace role, effective seller or finder badges, and the linked Sales person when present.
The UI must not render account id, workspace id, product id, secret material, auth provider, or auth subject.

An unlinked account row opens a dialog containing only active people where `isSeller || isFinder` and `accountId === null`.
The dialog labels each person as Vendedor, Finder, or Vendedor e Finder.
Confirming calls the link endpoint and keeps the action disabled while pending.
A linked row offers Desvincular behind an alert confirmation that explains the Hub account keeps its product access.
Conflict and eligibility errors remain in the dialog, preserve the current directory data, and do not optimistically show a link.

Add every new visible string to both `apps/web/src/i18n/pt-BR.json` and `apps/web/src/i18n/en.json`.

## Locked RED oracles

The executor must write all named tests before implementation and observe the expected failures.
After RED is observed, the behavioral assertions are locked and must not be weakened during Green.

### RED 1 - schema and tenant service

Create `apps/api/src/domains/sales-ops/__tests__/account-linking-service.test.ts` with these exact tests:

- `links an eligible account to a seller or finder inside the active tenant`
- `treats linking the same account to the same person as idempotent`
- `rejects a second account for an already linked person without changing it`
- `rejects an account already linked to another person in the tenant without changing either row`
- `allows the same account id to be linked in a different tenant`
- `rejects a collaborator-only person as not linkable`
- `unlinks only the active tenant person and leaves Hub access untouched`

Run:

```bash
pnpm --filter @fxl-sales/api test -- src/domains/sales-ops/__tests__/account-linking-service.test.ts
```

Expected RED is a compile failure because `salesOpsPeople.accountId` and the account-linking service do not exist.

### RED 2 - admin routes and Hub validation

Create `apps/api/src/domains/sales-ops/__tests__/account-linking-routes.test.ts` around an injected fake SDK client and database service.
Lock these exact tests:

- `lists the active workspace product directory and joins only same-tenant people`
- `rejects non-admin list link and unlink requests with 403 before calling Hub`
- `validates the target through Hub immediately before linking`
- `rejects an ineligible or cross-workspace account without writing`
- `rejects a Hub workspace or product mismatch without writing`
- `maps account and person conflicts to stable 409 errors`
- `maps Hub unavailability to 503 without falling back to local email matching`
- `never sends the OAuth client secret to the directory client`

Run:

```bash
pnpm --filter @fxl-sales/api test -- src/domains/sales-ops/__tests__/account-linking-routes.test.ts
```

Expected RED is a compile failure because the published SDK and Sales admin router do not expose the planned interfaces.

### RED 3 - database constraint and cross-tenant isolation

Create `apps/api/test/rls/sales-ops-account-linking.test.ts` using the existing integration database setup.
Lock these exact tests:

- `stores one account per person and one person per account inside an org`
- `allows the same account id in two orgs`
- `tenant context cannot read update or unlink another org person`
- `the generated migration keeps FORCE ROW LEVEL SECURITY and adds no database role`

Run:

```bash
pnpm --filter @fxl-sales/api test:integration -- test/rls/sales-ops-account-linking.test.ts
```

Expected RED is a missing column or missing unique-index failure.

### RED 4 - navigation and administrator UI

Extend `navigation.test.ts` and `routing.test.tsx`, then create `accounts/__tests__/AccountLinkingView.test.tsx`.
Lock these exact tests:

- `exposes usuarios only inside the admin Cadastros workspace`
- `redirects seller-only and finder-only users away from cadastros usuarios`
- `renders loading empty error and loaded directory states`
- `never renders raw account workspace or product ids`
- `links an unlinked eligible account and invalidates directory and bootstrap queries`
- `shows linked seller and finder details from the server response`
- `unlinks only after confirmation and explains that Hub access remains`
- `keeps conflict and ineligible errors visible without optimistic reassignment`
- `loads the next Hub directory page without duplicating accounts`

Run:

```bash
pnpm --filter @fxl-sales/web test -- src/sales-ops/__tests__/navigation.test.ts src/sales-ops/__tests__/routing.test.tsx src/sales-ops/accounts/__tests__/AccountLinkingView.test.tsx
```

Expected RED is a missing `usuarios` view, missing component, and missing hooks.

## Green implementation sequence

- [ ] Upgrade both Sales package manifests and `pnpm-lock.yaml` to the first published SDK version containing `createHubProductAccessClient`, using the registry artifact only.
- [ ] Add `accountId` and the per-org unique index to `salesOpsPeople`.
- [ ] Generate the named migration and inspect the generated SQL without hand-editing it.
- [ ] Implement the tenant-scoped link, unlink, conflict, idempotency, and same-tenant join service.
- [ ] Implement the injected Hub client route factory and mount it behind `appAuthMiddleware` plus `requireAdmin`.
- [ ] Keep the request bearer memory-only and pass it only to the SDK directory client.
- [ ] Add the `usuarios` route and Cadastros navigation item.
- [ ] Implement the account types, API facade, paginated query, link mutation, unlink mutation, and invalidations.
- [ ] Implement the focused account directory view with loading, empty, error, loaded, conflict, and confirmation states.
- [ ] Add English and Portuguese strings.
- [ ] Run all focused RED oracles until green.
- [ ] Run the full local machine gate.

## End-to-end oracle

Run the real Hub, Sales API, Sales web app, and PostgreSQL once, never in watch mode when a run-once command is available.
Seed one workspace administrator, one Sales seller account, one Sales finder account, one same-workspace member without Sales access, and one account that exists only in another workspace.
Seed two unlinked Sales people in the active workspace and one person in another Sales tenant.

Using the browser as the workspace administrator, open `/cadastros/usuarios`.
Verify the administrator, seller, and finder accounts are visible by safe display fields.
Verify the member without Sales access and the other-workspace account are absent.
Verify no raw account id, workspace id, product id, auth provider, auth subject, or secret appears in visible text or browser logs.

Link the seller account to the intended seller person.
Verify the success state appears without a full-page reload and remains after a browser reload.
Attempt to link that account to the second person through the real API and verify `409 account_already_linked` while both database rows remain unchanged.
Attempt to link the other-workspace account and verify `422 account_not_eligible` with no database write.

Sign in as the seller and call each Sales admin directory route.
Verify list, link, and unlink each return `403`.
Sign back in as the administrator, unlink the seller account, and verify the row becomes available for linking while the seller still retains Hub product access.

Inspect the page at desktop and narrow viewport widths.
Reject the slice if rows overlap, controls clip, dialogs exceed the viewport, loading causes large layout shifts, focus is lost, or identifiers appear as visible fallbacks.

Stop the Sales web process, Sales API process, Hub processes, database helpers, and every worker process group started for the oracle before finishing the turn.

## Verification commands

```bash
pnpm --filter @fxl-sales/api test -- src/domains/sales-ops/__tests__/account-linking-service.test.ts src/domains/sales-ops/__tests__/account-linking-routes.test.ts
pnpm --filter @fxl-sales/api test:integration -- test/rls/sales-ops-account-linking.test.ts
pnpm --filter @fxl-sales/web test -- src/sales-ops/__tests__/navigation.test.ts src/sales-ops/__tests__/routing.test.tsx src/sales-ops/accounts/__tests__/AccountLinkingView.test.tsx
pnpm run lint
pnpm run type-check
pnpm test
pnpm run build
pnpm --filter @fxl-sales/api test:integration
```

Gate 2 must be performed locally by an agent that did not implement the slice.
No release or promotion is authorized by this plan.

## Unpark condition

Change this plan from `parked` only after the audience-correct Hub endpoints are deployed, the matching SDK package is published to the registry, FXL Sales installs that published version, and a focused contract test proves a `product.fxl-sales` token can use the directory without any Hub-only token or secret.
