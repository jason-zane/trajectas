#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvContent(content) {
  const entries = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }

  return entries;
}

function readEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  return parseEnvContent(readFileSync(filePath, "utf8"));
}

function readLocalSupabaseEnv(cwd) {
  try {
    const output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    const parsed = parseEnvContent(output);

    return {
      ...parsed,
      NEXT_PUBLIC_SUPABASE_URL:
        parsed.NEXT_PUBLIC_SUPABASE_URL ?? parsed.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        parsed.ANON_KEY ??
        parsed.PUBLISHABLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY:
        parsed.SUPABASE_SERVICE_ROLE_KEY ??
        parsed.SERVICE_ROLE_KEY ??
        parsed.SECRET_KEY,
      DATABASE_URL: parsed.DATABASE_URL ?? parsed.DB_URL,
    };
  } catch {
    return {};
  }
}

const cwd = process.cwd();
const envFromFile = readEnvFile(resolve(cwd, ".env.e2e.local"));
const envFromSupabase =
  envFromFile.NEXT_PUBLIC_SUPABASE_URL &&
  envFromFile.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  envFromFile.SUPABASE_SERVICE_ROLE_KEY
    ? {}
    : readLocalSupabaseEnv(cwd);
const host = process.env.HOSTNAME ?? envFromFile.HOSTNAME ?? "127.0.0.1";
const port = process.env.PORT ?? envFromFile.PORT ?? "3101";
const baseUrl = `http://${host}:${port}`;

const env = {
  ...process.env,
  ...envFromSupabase,
  ...envFromFile,
  HOSTNAME: host,
  PORT: port,
  NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? "1",
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL ?? envFromFile.PUBLIC_APP_URL ?? baseUrl,
  ADMIN_APP_URL: process.env.ADMIN_APP_URL ?? envFromFile.ADMIN_APP_URL ?? baseUrl,
  ASSESS_APP_URL:
    process.env.ASSESS_APP_URL ?? envFromFile.ASSESS_APP_URL ?? `${baseUrl}/assess`,
  PARTNER_APP_URL:
    process.env.PARTNER_APP_URL ?? envFromFile.PARTNER_APP_URL ?? `${baseUrl}/partner`,
  CLIENT_APP_URL:
    process.env.CLIENT_APP_URL ?? envFromFile.CLIENT_APP_URL ?? `${baseUrl}/client`,
  SERVER_ACTION_ALLOWED_ORIGINS:
    process.env.SERVER_ACTION_ALLOWED_ORIGINS ??
    envFromFile.SERVER_ACTION_ALLOWED_ORIGINS ??
    `${host}:${port},localhost:${port}`,
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    envFromFile.NEXT_PUBLIC_SUPABASE_URL ??
    envFromSupabase.NEXT_PUBLIC_SUPABASE_URL ??
    "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    envFromFile.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    envFromSupabase.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "local-dev-anon-key",
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    envFromFile.SUPABASE_SERVICE_ROLE_KEY ??
    envFromSupabase.SUPABASE_SERVICE_ROLE_KEY ??
    "local-dev-service-role-key",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    envFromFile.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
};

const nextBin = resolve(cwd, "node_modules/next/dist/bin/next");
const child = spawn(
  process.execPath,
  [nextBin, "dev", "--hostname", host, "--port", port],
  {
    cwd,
    env,
    stdio: "inherit",
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("Failed to start the Next.js test server.", error);
  process.exit(1);
});
