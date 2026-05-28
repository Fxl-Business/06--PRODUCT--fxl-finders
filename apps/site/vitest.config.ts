import { defineConfig } from 'vitest/config';

/**
 * Vitest config for apps/site (Phase 04). Unit tests for the /r/[code] click
 * handler + UA classifier. The click-handler tests mock ./db and the shared HMAC
 * util so no live DB is needed.
 */
export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
