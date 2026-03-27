#!/usr/bin/env node

/**
 * Check migration status against the remote database.
 *
 * Usage:  npm run db:status
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "rwpfwfcaxoevnvtkdmkx";

const envPath = resolve(process.cwd(), ".env.local");
let password;
try {
  const envFile = readFileSync(envPath, "utf-8");
  const match = envFile.match(/^DATABASE_PASSWORD=(.+)$/m);
  password = match?.[1]?.trim();
} catch {
  console.error("Could not read .env.local — make sure it exists.");
  process.exit(1);
}

if (!password) {
  console.error("DATABASE_PASSWORD not found in .env.local");
  process.exit(1);
}

const dbUrl = `postgresql://postgres:${password}@db.${PROJECT_REF}.supabase.co:5432/postgres`;

try {
  execFileSync("npx", ["supabase", "migration", "list", "--db-url", dbUrl, ...process.argv.slice(2)], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
} catch {
  process.exit(1);
}
