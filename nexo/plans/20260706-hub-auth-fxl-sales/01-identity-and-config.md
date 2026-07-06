---
id: 01-identity-and-config
milestone: hub-auth-fxl-sales
status: done
depends_on: []
files_modified:
  - package.json
  - apps/api/package.json
  - apps/web/package.json
  - apps/site/package.json
  - packages/shared-types/package.json
  - packages/shared-utils/package.json
  - apps/api/src/env.ts
  - packages/shared-types/src/env.ts
  - apps/api/src/config/auth-provider.ts
  - apps/web/src/auth/provider.ts
acceptance: "given Hub envs are set, when config is loaded, then the Hub contract is explicit and testable"
---

# 01 - Identity And Config

## Oracle Tests

- `pnpm --filter @fxl-sales/api test src/config/__tests__/auth-provider.test.ts`
- `pnpm --filter @fxl-sales/web test src/auth/__tests__/provider.test.ts`

## Plan

- Rename workspace package identity to `fxl-sales` and `@fxl-sales/*`.
- Add API env support for `FXL_HUB_API_URL`, `FXL_HUB_PUBLISHABLE_KEY`, `FXL_HUB_SECRET_KEY`, and optional `FXL_HUB_AUDIENCE`.
- Add web Hub browser config from Vite env values.
- Keep auth selection Hub-only.
