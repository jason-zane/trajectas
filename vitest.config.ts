import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
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
        "src/lib/assess/access.ts",
        "src/lib/next-config/security.ts",
        "src/hooks/use-auto-save.ts",
        "src/components/animated-number.tsx",
        "src/components/scroll-reveal.tsx",
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
