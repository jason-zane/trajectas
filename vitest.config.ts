import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      "server-only": resolve(rootDir, "tests/mocks/server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "src/lib/hosts.ts",
        "src/lib/security/request-origin.ts",
        "src/lib/experience/resolve.ts",
        "src/lib/experience/flow-router.ts",
        "src/lib/scoring/pipeline.ts",
        "src/lib/scoring/transforms.ts",
        // Psychometric engine — now covered by the IRT/CTT/item-stats suites.
        "src/lib/scoring/irt/models.ts",
        "src/lib/scoring/irt/estimation.ts",
        "src/lib/scoring/ctt/scoring.ts",
        "src/lib/scoring/item-statistics.ts",
        "src/lib/assess/access.ts",
        // DAL pure row → DTO transforms (I/O-free; queries are integration-tested).
        "src/lib/dal/participants-mappers.ts",
        "src/lib/dal/campaigns-mappers.ts",
        "src/lib/next-config/security.ts",
        "src/hooks/use-auto-save.ts",
        "src/components/animated-number.tsx",
        "src/components/scroll-reveal.tsx",
        // Email render — tested by email-render.test.ts (100/71.42/100/100)
        "src/lib/email/render.ts",
        // Report tokens — tested by report-token-secrets.test.ts (100/87.5/100/100)
        "src/lib/reports/token-secrets.ts",
        // Comparison utilities — tested by comparison/ suite
        "src/lib/comparison/resolve-bands.ts",  // (90/91.66/100/100)
        "src/lib/comparison/session-resolution.ts",  // (100/73.91/100/100)
        // Canvas summaries — tested by canvas/summarize.test.ts
        "src/lib/canvas/summarize.ts",
        // Instrument builder engine — pure science core, tested by instrument-*.test.ts
        "src/lib/instrument/blueprint.ts",
        "src/lib/instrument/congruence.ts",
        "src/lib/instrument/evidence.ts",
        "src/lib/instrument/reliability.ts",
        "src/lib/instrument/blueprint-draft.ts",
        "src/lib/instrument/stages/registry.ts",
        "src/lib/instrument/stages/runner.ts",
        "src/lib/dal/instrument-mappers.ts",
        "src/lib/instrument/item-generation.ts",
        "src/lib/instrument/stages/definitions.ts",
      ],
      thresholds: {
        perFile: true,
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
});
