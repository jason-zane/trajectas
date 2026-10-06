import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

// A dedicated env-free worktree avoids Next/Vitest loading the founder's
// production .env.local. This runner does not provision/reset a database or
// test a hosted URL. Local DB checks are separate and explicitly scoped.
const envFiles = readdirSync(".").filter((file) =>
  (file === ".env" || file.startsWith(".env.")) && !file.endsWith(".example"));
const appEnv = Object.keys(process.env).filter((name) =>
  /^(NEXT_PUBLIC_|SUPABASE_|DATABASE_URL$|PLAYWRIGHT_|PUBLIC_APP_URL$|ADMIN_APP_URL$|ASSESS_APP_URL$|PARTNER_APP_URL$|CLIENT_APP_URL$|COOKIE_DOMAIN$|SERVER_ACTION_|TRAJECTAS_|INTERNAL_|INTEGRATIONS_|REPORT_|RESEND_|EMAIL_FROM$|OPS_ALERT_|CRON_|STRIPE_|OpenRouter_|OPENROUTER_|ANTHROPIC_|OPENAI_|KV_REST_|UPSTASH_)/.test(name));
if (envFiles.length || appEnv.length) {
  console.error("Use an isolated worktree without .env files or inherited application/provider variables. No checks ran; no values were printed.");
  process.exit(1);
}

// CI=true prevents test-server discovery/downloads and reusing another
// session's app server. All smoke URLs use the local managed server.
const env = { ...process.env, CI: "true", NEXT_TELEMETRY_DISABLED: "1" };
for (const command of ["test:release", "lint", "typecheck", "test:unit", "test:component", "test:architecture", "build", "test:e2e:smoke"]) {
  console.log(`Running ${command}`);
  const result = spawnSync("npm", ["run", command], { env, stdio: "inherit" });
  if (result.error || result.status !== 0) {
    console.error(`Local validation stopped at ${command}; later checks were not run.`);
    process.exit(result.status || 1);
  }
}
