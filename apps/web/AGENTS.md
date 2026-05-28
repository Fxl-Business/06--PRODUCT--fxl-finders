# apps/web — agent guide

## Stack

React 18 + Vite + TypeScript + Tailwind + shadcn/ui (manual copy, no CLI dependency) + Clerk + TanStack Query + React Router v6 + react-i18next.

## Layout

```
src/
├── main.tsx               # entrypoint: createRoot + <App />
├── App.tsx                # ClerkProvider + QueryClient + RouterProvider
├── router.tsx             # createBrowserRouter, route guards
├── index.css              # Tailwind directives + CSS variables (light/dark tokens)
├── i18n/                  # react-i18next setup, PT-BR + EN bundles
├── lib/
│   ├── api-client.ts      # apiFetch — TanStack Query target
│   ├── displayNames.ts    # userLabel / orgLabel — NEVER render raw Clerk IDs
│   └── utils.ts           # cn() class merger
├── components/
│   ├── layout/            # AppShell, Sidebar, TopBar
│   └── ui/                # shadcn baseline: button, card, input, label,
│                          # skeleton, kpi-card, empty-state
└── pages/                 # Home, Items, Config
```

## Rules

1. **Empty/loading/loaded triad.** Every data view follows:
   - `isLoading === true` → `<Skeleton />` (never empty state, never content)
   - `!isLoading && empty` → `<EmptyState />`
   - `!isLoading && data` → content
2. **KPICard for all metrics.** Use `<KPICard title value icon isLoading colorScheme>`. Don't roll your own metric tile.
3. **Named exports only.** No `export default`.
4. **No raw Clerk IDs.** Always go through `userLabel` / `orgLabel`. Style fallback with `font-mono text-xs text-muted-foreground`.
5. **TanStack Query for server state.** Mutations invalidate every queryKey whose underlying data could change. Use `invalidateQueries`, never `resetQueries`.
6. **Array selects safe.** `select: (data) => Array.isArray(data) ? data : []` — never crash on `undefined`.
7. **i18n primary PT-BR.** Add new strings to both `pt-BR.json` and `en.json`.
8. **No `any`.** Use `unknown` + type guards. ESLint enforces this.

## Adding shadcn components

The template ships baseline components in `src/components/ui/` copied from shadcn templates. To add more:

```bash
# Either copy from shadcn docs into src/components/ui/ + install peer deps,
# or use the shadcn CLI (configured via components.json):
pnpm dlx shadcn@latest add <name>
```

## Commands

```bash
pnpm dev              # vite (port 8006)
pnpm build            # tsc --noEmit + vite build
pnpm type-check       # tsc --noEmit
pnpm lint             # eslint src/
```
