# Run 20260706-1815-hub-redirect-hotfix

## Goal

Fix local FXL Hub login for `product.fxl-sales`.
The running Hub rejected `/authorize` because the Sales app sent an unregistered callback and the local Hub OAuth client row had an empty redirect allowlist.

## Changes

- API local redirect resolution now derives the callback from `CORS_ORIGIN`, so local dev uses `http://localhost:8006/auth/callback`.
- Web Hub auth uses same-origin `/auth/*` routes by default.
- Vite proxies `/auth/*` to the API BFF on `http://localhost:3006`.
- Local env examples document the auth proxy and callback route.
- Standing docs and prior audit notes now point at the product callback route instead of assuming the API origin.
- The local Hub `fxl-sales` OAuth client row was updated with local redirect URIs and the Hub API watcher was restarted so the row is visible to `/authorize`.

## Verification

- `curl -sS -D - http://localhost:8006/auth/login -o /tmp/fxl-sales-auth-final-body` returned `302 Found`.
- The `Location` header contained `redirect_uri=http%3A%2F%2Flocalhost%3A8006%2Fauth%2Fcallback`.
- `pnpm --filter @fxl-sales/api test src/middleware/__tests__/app-auth.test.ts` passed.
- `pnpm --filter @fxl-sales/web test src/auth/__tests__/provider.test.ts` passed.
- `pnpm run lint` passed.
- `pnpm run type-check` passed.
- `pnpm test` passed.
- `pnpm run build` passed.
- `pnpm --filter @fxl-sales/api test:integration` passed.
- `git diff --check` passed.
- `node scripts/no-legacy-auth.mjs` passed.

## Notes

- The ignored local `apps/api/.env` was corrected to use `FXL_HUB_API_URL=http://localhost:9016`.
- The ignored local `apps/web/.env` was corrected to use `VITE_FXL_HUB_API_URL=http://localhost:9016`.
- Both ignored env files were updated for the new callback and proxy shape.
- Gate 2 separate-agent verification passed.
