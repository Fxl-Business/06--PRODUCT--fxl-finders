# apps/mobile - agent guide

## Stack

Expo SDK 54, Expo Router 6, React Native 0.81, React 19.1, NativeWind 4, and TanStack Query.
The mobile app is a standalone pnpm scope and is not part of the root workspace.

## Layout

```text
app/
├── _layout.tsx            # QueryClientProvider, StatusBar, Stack
├── index.tsx              # redirects into tabs
└── (tabs)/
    ├── _layout.tsx        # tab navigator
    ├── index.tsx          # dashboard/home
    └── settings.tsx       # settings screen
lib/                       # shared mobile helpers
```

## Rules

1. Keep API base URL in `EXPO_PUBLIC_API_URL`.
2. Keep auth and commerce browser flows owned by FXL Hub.
3. Never render raw account or workspace ids in user-facing UI.
4. Keep screens usable in Expo Go for layout work.
5. Use dev builds when adding native capabilities.
6. Run mobile checks from `apps/mobile`, not the root workspace.

## Commands

```bash
pnpm install
pnpm start
pnpm ios
pnpm android
pnpm type-check
pnpm lint
```
