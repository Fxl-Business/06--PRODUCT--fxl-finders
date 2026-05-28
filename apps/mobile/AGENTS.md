# apps/mobile — agent guide

## Stack

Expo SDK 54 + Expo Router 6 + React Native 0.81 + React 19.1 + NativeWind 4 + Clerk Expo + TanStack Query. Standalone pnpm scope (not in root workspace).

## Layout

```
app/                       file-based routing (expo-router)
├── _layout.tsx            ClerkProvider, QueryClient, Stack
├── index.tsx              entry redirect by auth state
├── (auth)/sign-in.tsx     email+password Clerk flow
└── (tabs)/                tab navigator after auth
components/                native UI primitives
lib/                       helpers (clerk-token-cache, api-client when added)
```

## Rules

1. **No raw Clerk IDs in UI** (same as web). When rendering user info, use `user.emailAddresses[0]?.emailAddress ?? user.firstName ?? user.id`.
2. **className via NativeWind** for styling. Do NOT use inline `style` objects unless dynamic.
3. **SafeAreaView at screen root.** Always wrap tab/auth screens in `<SafeAreaView edges={[...]}/>` from `react-native-safe-area-context`.
4. **No DB calls from mobile.** Fetch via `apps/api`. Mirror the api-client pattern.
5. **Standalone pnpm scope** — `pnpm install` only inside `apps/mobile/`. Do not symlink to root.
6. **Secure storage** — auth tokens via `expo-secure-store`. Never `AsyncStorage` for secrets.

## Commands

```bash
pnpm start             # Expo dev server
pnpm ios               # iOS native build (Xcode required)
pnpm android           # Android native build (Android Studio required)
pnpm type-check
pnpm lint
```

## Dev build vs Expo Go

Clerk on native requires a dev build for the full sign-in flow. Expo Go is fine for layout/visual development. To create a dev build: `eas build --profile development --platform ios` (or android).
