/**
 * Config for the live parity check in scripts/evals/jev-engine-parity.spec.ts.
 * Not part of CI (the main config only includes tests/**). Run with:
 *   npx vitest run --config scripts/evals/vitest.parity.config.ts
 */
import { defineConfig } from 'vitest/config'
import base from '../../vitest.config'

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    // Replace (not merge) the include list so only the parity spec runs.
    include: ['scripts/evals/**/*.spec.ts'],
    coverage: { enabled: false },
    testTimeout: 120_000,
  },
})
