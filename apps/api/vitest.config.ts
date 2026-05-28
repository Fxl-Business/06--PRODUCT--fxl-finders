import { defineConfig } from 'vitest/config';

/**
 * Vitest config — unit vs integration split (D-G).
 *
 * Vitest 2.x has no `test.projects` key (that is a Vitest 3+ API). The
 * equivalent split here is driven by the VITEST_INTEGRATION env flag, wired via
 * package.json scripts:
 *   - `pnpm test`              → unit only. Includes src/**\/__tests__, EXCLUDES
 *                                test/rls/** and runs NO globalSetup.
 *   - `pnpm test:integration`  → RLS integration only. Includes ONLY test/rls/**
 *                                and runs the migrate-first globalSetup.
 *
 * The RLS integration tests connect as the unprivileged fxl_finders_app role
 * (NOT postgres/superuser) so RLS is actually exercised (D-G).
 */
const isIntegration = process.env.VITEST_INTEGRATION === '1';

export default defineConfig({
  test: isIntegration
    ? {
        include: ['test/rls/**/*.test.ts'],
        globalSetup: ['./test/rls/global-setup.ts'], // D-G: migrate before RLS tests
        testTimeout: 30000,
        hookTimeout: 30000,
        // The integration suite shares ONE Postgres test DB and exercises GLOBAL
        // tables (conversions/webhook_events and the hash-chained audit_log). Two
        // conversion-ingesting files (Phase 05 conversion-ingest + Phase 06
        // conversion-webhook-contract) corrupt each other's attribution/dedup/audit
        // assertions if run in parallel workers. Force serial file execution so the
        // shared-DB integration tests are deterministic.
        fileParallelism: false,
      }
    : {
        include: ['src/**/__tests__/**/*.test.ts'],
        exclude: ['node_modules/**', 'dist/**', 'test/rls/**'],
        // Phase 01 ships only RLS integration tests (run via test:integration).
        // Unit suite is empty for now — don't fail the gate / future CI on it.
        passWithNoTests: true,
      },
});
