# apps/web - agent guide

## Stack

React 18, Vite, TypeScript, Tailwind, shadcn/ui components, FXL Hub SDK, TanStack Query, React Router v6, and react-i18next.

## Layout

```text
src/
├── main.tsx               # entrypoint: createRoot + <App />
├── App.tsx                # app providers + RouterProvider
├── router.tsx             # createBrowserRouter and route guards
├── index.css              # Tailwind directives + CSS variables
├── auth/                  # Hub browser client and React auth adapters
├── i18n/                  # react-i18next setup, PT-BR + EN bundles
├── lib/
│   ├── api-client.ts      # apiFetch and token injection
│   ├── displayNames.ts    # userLabel and orgLabel helpers
│   └── utils.ts           # cn() class merger
├── components/
│   ├── layout/            # AppShell, Sidebar, TopBar
│   └── ui/                # shadcn baseline components
└── pages/                 # route pages
```

## Rules

1. Every data view follows the empty, loading, loaded triad.
2. `isLoading === true` renders `<Skeleton />`.
3. `!isLoading && empty` renders `<EmptyState />`.
4. `!isLoading && data` renders content.
5. Use `<KPICard title value icon isLoading colorScheme>` for all metrics.
6. Use named exports only.
7. Never render raw account or workspace ids in customer-facing UI.
8. TanStack Query owns server state.
9. Mutations invalidate every query key whose underlying data could change.
10. Use `select: (data) => Array.isArray(data) ? data : []` for array selects.
11. Add new strings to both `pt-BR.json` and `en.json`.
12. Use `unknown` plus type guards instead of `any`.

## Adding shadcn Components

```bash
pnpm dlx shadcn@latest add <name>
```

## Commands

```bash
pnpm dev
pnpm build
pnpm type-check
pnpm lint
pnpm test
```
