# Gate 2 Verify Report

Status: PASS.

- `pnpm run lint` passed.
- `pnpm run type-check` passed.
- `pnpm test` passed with 18 files and 178 tests.
- `pnpm run build` passed.
- `pnpm --filter @fxl-sales/api test:integration` passed with 7 files and 25 tests.
- `curl -sS -D - http://localhost:8006/auth/login -o /tmp/fxl-sales-verifier-auth-body` returned `HTTP/1.1 302 Found`.
- The `Location` header contained `redirect_uri=http%3A%2F%2Flocalhost%3A8006%2Fauth%2Fcallback`.

Notable output:

- Vite emitted its CJS Node API deprecation warning during tests.
- Site negative-path click-handler tests printed expected stderr.
- Integration tests printed existing Postgres skip notices for the drizzle schema and migrations table.
