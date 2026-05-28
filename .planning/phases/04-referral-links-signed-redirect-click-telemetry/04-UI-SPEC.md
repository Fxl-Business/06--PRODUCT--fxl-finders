# Phase 04 — UI-SPEC (finder link generator + clicks dashboard)

Produced inline under autopilot (no interactive pause — same convention as Phase 02/03). Contract followed by all T08/T09 frontend work. Reuses the existing design system (shadcn/ui already installed: button, card, dialog, alert-dialog, badge, select, table, tabs, input, label, skeleton, empty-state, kpi-card).

## Layout
- Both pages live under `FinderShell` (left sidebar nav + `p-8` main content), guarded by `Protected` (Clerk SignedIn) → `RoleGuard role="finder"`. Mirrors `AdminShell` structure from Phase 02.
- `FinderShell` sidebar gains a "Cliques" nav item (`{ to: '/finder/clicks', icon: MousePointerClick, key: 'nav.clicks' }`) alongside the existing "Links" item.

## Loading-state contract (CLAUDE.md, mandatory — non-negotiable)
- `isLoading === true` → skeleton (never empty state, never content). Links list = 3× `<Skeleton className="h-24 w-full" />` card-shaped rows; clicks table = 5× `<Skeleton className="h-12 w-full" />` row-shaped.
- `!isLoading && empty` → `<EmptyState>` with title + description (+ primary action on links page).
- `!isLoading && data` → content.

## KPICards (mandatory for all metrics)
- Use `<KPICard title value icon isLoading colorScheme />` for every metric. Never inline a metric.
- LinksPage row: "Links ativos" (icon `Link2`, colorScheme `primary`, value = active link count), "Total de cliques" (icon `MousePointerClick`, colorScheme `default`, value = `stats?.total ?? '—'`), "Cliques únicos" (icon `Users`, colorScheme `default`, value = `stats?.unique ?? '—'`).
- ClicksPage row: "Total de cliques", "Cliques únicos", "Taxa de conversão" (value ALWAYS `'—'`, colorScheme `default`, isLoading `false` — Phase 05 placeholder; never render a number).

## Link generator (T08)
- `LinksPage`: KPICards row at top, then a "Gerar Link" primary button opening `<Dialog>` with `<LinkGeneratorForm>`. On success: close dialog + render a "recém-gerado" banner card (`LinkCard` with `fullUrl` visible + copy button).
- `LinkGeneratorForm` fields, top→bottom: App `<Select>` (from `useFinderApps()` → `GET /api/v1/finder/apps`), Product `<Select>` (from `useFinderProducts(appId)` → `GET /api/v1/finder/apps/:appId/products`, disabled until app chosen), Setup (R$) input, Mensalidade (R$) input. Prices entered in reais, converted to int cents at API boundary (`Math.round(float*100)`).
- Band-hint text below each price input: "Entre R$ {min} e R$ {max}" (min/max ÷100 for display). Client-side validation blocks submit when value is outside band; inline error shown.
- Submit button label `finder.links.form.submit`; disabled while submitting or invalid; shows `finder.links.form.submitting` text while pending.
- Form state machine: `idle → filling → submitting → success(link, fullUrl) | error`.
- NEVER reuse `useAdminApps`/`useAdminProducts` (admin routes are `requireAdmin`-gated → a finder JWT 403s).

## LinkCard (T08)
- Displays: `code`, short URL (`fullUrl`), status `<Badge>` (default=Ativo / secondary=Revogado), quoted setup + monthly (R$ via shared-utils money formatter), created date.
- Copy button: `navigator.clipboard.writeText(fullUrl)` → "Copiado!" for 2s.
- Revoke button (only when `status === 'active'`): opens `<AlertDialog>` confirmation → `useRevokeLink()`; on success `invalidateQueries({ queryKey: ['finder','links'] })`.

## Clicks dashboard (T09)
- `ClicksPage`: KPICards row (total / unique / conversion-rate placeholder), then `<ClicksTable>`. Optional `linkId` URL search param renders a filter chip "Filtrando por link" + clear button.
- `ClicksTable` columns: Data/hora (`Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'})`), Navegador (capitalized `uaFamily`), Origem (`referer ?? '—'`), País (`country ?? '—'`), UTM Source (`utmSource ?? '—'`).
- PRIVACY: NEVER render `click_id`, `ip_hash`, or `link_id` in the table or anywhere in the UI (raw-ID + PII rule).

## Identifiers (no raw Clerk IDs)
- No `user_*` / `org_*` raw IDs rendered. Finder reads its own data; no cross-actor display in this phase.

## i18n
- All strings via `useTranslation()`. New keys under `finder.links.*`, `finder.clicks.*`, `nav.clicks` added to BOTH `pt-BR.json` (primary) and `en.json` (key-set equality enforced by the Phase 03 `keys-resolve` test).

## Verdict
APPROVED (inline, autopilot). All 6 dimensions (layout, loading-state, KPI, copy/i18n, identifiers, privacy) resolved against the existing design system. No new shadcn components required.
