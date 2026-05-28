import { defineConfig } from 'vitest/config';

/**
 * Vitest config for shared-utils (Phase 04). Runs the HMAC unit tests against
 * source (no build needed for tests — the .js extension in imports resolves to
 * the .ts source under Vitest's resolver).
 */
export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    passWithNoTests: true,
  },
});
