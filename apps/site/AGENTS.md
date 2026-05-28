# apps/site — agent guide

## Stack

Next.js 15 (App Router) + React 19 + Tailwind v4 + TypeScript. Deployed to Vercel.

## Layout

```
src/
├── app/
│   ├── layout.tsx          # root layout, lang="pt-BR", Vercel Analytics gated
│   ├── page.tsx            # landing — Hero + Features + HowItWorks + Footer
│   └── globals.css         # @import "tailwindcss" + theme tokens
├── components/
│   ├── Hero.tsx            # hero section with CTA → webUrl env
│   ├── Features.tsx        # 3-column feature grid
│   ├── HowItWorks.tsx      # 4-step timeline
│   ├── Footer.tsx          # links + copyright
│   └── Button.tsx          # local cva button (mirrors apps/web shadcn pattern)
└── lib/
    └── utils.ts            # cn() — clsx + tailwind-merge
```

## Rules

1. **Server components by default.** Add `'use client'` only when needed (state, effects, event handlers).
2. **Tailwind v4 import syntax.** Use `@import "tailwindcss"` not `@tailwind` directives. Tokens via `@theme { --color-* }`.
3. **No client-side data fetching.** This is a landing page. Server-rendered, no API calls.
4. **Env vars at boundary.** Read `process.env.NEXT_PUBLIC_*` once in server components; pass values down as props.
5. **Lucide icons.** Match the icon set used by `apps/web` for visual consistency.
6. **Named exports for components.** `app/page.tsx` and `app/layout.tsx` are the only allowed default exports (Next requires them).

## Commands

```bash
pnpm dev       # next dev --turbopack on port 4006
pnpm build     # next build
pnpm start     # next start
pnpm type-check
pnpm lint
```

## Vercel deploy

`vercel.json` points at the monorepo root build command. After init, link the project with `vercel link`, then `vercel deploy`.
