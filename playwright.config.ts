import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3101";
const useManagedWebServer = !process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // Mints the seeded admin session (tests/e2e/seeded/.auth/admin.json) before
    // the seeded specs. Scoped to its own project so it only runs when seeded
    // tests are selected — the smoke suite runs without a Supabase stack and
    // must not trigger it.
    {
      name: "seeded-setup",
      testMatch: /seeded\/admin-auth\.setup\.ts$/,
    },
    // The partner journey signs in as a different seeded actor, so it needs its
    // own storageState minted before the seeded specs run.
    {
      name: "seeded-partner-setup",
      testMatch: /seeded\/partner-auth\.setup\.ts$/,
    },
    {
      name: "seeded",
      testMatch: /seeded\/.*\.spec\.ts$/,
      dependencies: ["seeded-setup", "seeded-partner-setup"],
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "smoke",
      testMatch: /smoke\/.*\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: useManagedWebServer
    ? {
        command: "npm run dev:test",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
