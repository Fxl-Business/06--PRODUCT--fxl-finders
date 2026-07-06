# fxl-sales mobile

Expo Router, React Native, NativeWind, and TanStack Query.
This app is standalone and is not part of the root pnpm workspace.

## Setup

```bash
cd apps/mobile
pnpm install
cp .env.example .env
pnpm start
```

Set `EXPO_PUBLIC_API_URL` to the API base URL.

## Development

- Expo Go is enough for layout and most UI work.
- Use a dev build when adding native modules or testing native-only flows.
- Keep auth and commerce browser handoff owned by FXL Hub.

## Structure

```text
app/
├── _layout.tsx           QueryClientProvider + Stack
├── index.tsx             redirects into tabs
└── (tabs)/
    ├── _layout.tsx       tab navigator
    ├── index.tsx         dashboard
    └── settings.tsx      settings
```

## Commands

```bash
pnpm start
pnpm ios
pnpm android
pnpm type-check
pnpm lint
```
