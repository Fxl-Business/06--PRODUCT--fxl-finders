# Phase 02 — UI-SPEC (admin CRUD)

Produced inline under autopilot (no interactive pause). Contract followed by all T01/T06/T07/T08 frontend work.

## Layout
- `AdminShell` mirrors `AppShell`: left `AdminNav` (60-width card sidebar, NavLink active = `bg-secondary`), main content `p-8`, `<Suspense>` for lazy admin pages.
- Routes under `/admin/*` guarded by `Protected` (Clerk SignedIn) → `AdminGuard` (publicMetadata.role === 'admin', else `<Navigate to="/" />`).

## Loading-state contract (CLAUDE.md, mandatory)
- `isLoading` → 5× `<Skeleton className="h-12 w-full" />` in a table shape.
- `!isLoading && empty` → `<EmptyState>` with title/description + primary "Create" action.
- `!isLoading && data` → `<Table>`.

## Apps list (T06)
- Columns: Name, Slug (mono), Publishable Key (full, mono — public-safe), Secret Key (prefix `sk_xxxxxxx` only, mono), Status (`<Badge>` default=active / secondary=disabled), Actions.
- Row actions: Edit, Enable/Disable toggle, Rotate secret key, Rotate webhook secret.
- `AppDialog`: create/edit; slug input disabled in edit (and never sent — UpdateAppSchema omits it); hosts as newline textarea with help text "um host por linha, sem https:// nem caminho".

## Key reveal modal (T08)
- Step 1 warn (destructive confirm). Step 2 reveal: amber Alert "não será exibida novamente", plaintext in mono `<code>`, Copy button → "Copiado!" 2s, Close.
- Close while revealed+not-copied → AlertDialog "Você copiou a chave?".
- Plaintext only in local state; dropped on unmount (keyed remount) — never persisted.

## Products (T07)
- Products list: Name, Slug (mono), App (appName), Status (Badge), Actions (Edit, Manage → `/admin/products/:id`).
- `ProductDetail` at `/admin/products/:id`: `<Tabs>` → "Faixas de Preço" (two `PriceBandForm` cards: setup + monthly, side by side) + "Comissão" (`CommissionRuleForm`).
- `PriceBandForm`: R$ display, int-cents at API boundary (×/÷100); real-time `min<=list<=max` validation disables submit.
- `CommissionRuleForm`: setup %, recurring %, recurring months, basis `<Select>` (quoted_net/list_net).

## i18n
- All strings via `useTranslation()`. Keys under `admin.*` + `common.*` added to `pt-BR.json` (primary) and `en.json`.
