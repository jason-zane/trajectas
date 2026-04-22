#!/usr/bin/env node

/**
 * Migrate external brand logo URLs into our Supabase `brand-assets` bucket.
 *
 * Why: the app now rejects external logo URLs (only same-origin or Supabase
 * storage URLs are allowed) so CSP img-src can be tightened. This script
 * finds existing external logos, downloads them, re-uploads to the bucket,
 * and rewrites the column to point at the new storage URL.
 *
 * Usage:
 *   node scripts/migrate-brand-logos.mjs               # dry run (default)
 *   node scripts/migrate-brand-logos.mjs --apply       # actually write
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
 * .env.local. Expects the `brand-assets` bucket to already exist.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, extname } from "node:path";
import { randomUUID } from "node:crypto";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  const env = {};
  try {
    const raw = readFileSync(envPath, "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {
    console.error("Could not read .env.local");
    process.exit(1);
  }
  return env;
}

const env = loadEnv();
const APPLY = process.argv.includes("--apply");
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "brand-assets";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local");
  process.exit(1);
}

const supabaseHost = new URL(SUPABASE_URL).host;
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(
  `${APPLY ? "APPLYING" : "DRY RUN — pass --apply to write"}`,
  `\nSupabase: ${SUPABASE_URL}`,
  `\nBucket:   ${BUCKET}\n`,
);

function isExternal(url) {
  if (!url) return false;
  if (url.startsWith("/")) return false;
  try {
    const parsed = new URL(url);
    return parsed.host !== supabaseHost;
  } catch {
    return false;
  }
}

function guessExtension(contentType, originalUrl) {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("svg")) return "svg";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  try {
    const ext = extname(new URL(originalUrl).pathname).replace(".", "").toLowerCase();
    if (["png", "jpg", "jpeg", "svg", "webp", "gif"].includes(ext)) {
      return ext === "jpeg" ? "jpg" : ext;
    }
  } catch {}
  return "png";
}

async function downloadAndUpload(externalUrl, ownerType, ownerId) {
  const response = await fetch(externalUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`fetch ${externalUrl} → ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > 5 * 1024 * 1024) {
    throw new Error(`logo larger than 5MB: ${buffer.byteLength} bytes`);
  }
  const contentType = response.headers.get("content-type") ?? "image/png";
  const ext = guessExtension(contentType, externalUrl);

  const scope = ownerType === "platform" ? "platform/default" : `${ownerType}/${ownerId}`;
  const key = `${scope}/${Date.now()}-migrated-${randomUUID().slice(0, 8)}.${ext}`;

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(key, buffer, { contentType, upsert: false });
  if (uploadError) throw new Error(`upload failed: ${uploadError.message}`);

  const { data } = db.storage.from(BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

async function migrateTable(table, ownerTypeDerive) {
  const { data, error } = await db
    .from(table)
    .select("*");
  if (error) {
    console.error(`${table}: ${error.message}`);
    return { scanned: 0, changed: 0 };
  }

  let scanned = 0;
  let changed = 0;

  for (const row of data ?? []) {
    const config = row.config ?? {};
    let mutated = false;
    const patch = { ...config };

    for (const field of ["logoUrl", "logomarkUrl"]) {
      const value = config[field];
      if (!isExternal(value)) continue;
      scanned += 1;
      const ownerType = ownerTypeDerive(row);
      const ownerId = row.owner_id ?? null;
      console.log(`  ${table}#${row.id} ${field}: ${value}`);
      if (APPLY) {
        try {
          const newUrl = await downloadAndUpload(value, ownerType, ownerId);
          patch[field] = newUrl;
          mutated = true;
          console.log(`    → ${newUrl}`);
        } catch (err) {
          console.error(`    ! ${String(err.message ?? err)}`);
        }
      }
    }

    if (mutated) {
      const { error: updateError } = await db
        .from(table)
        .update({ config: patch })
        .eq("id", row.id);
      if (updateError) {
        console.error(`    ! update failed: ${updateError.message}`);
      } else {
        changed += 1;
      }
    }
  }

  return { scanned, changed };
}

async function main() {
  const configs = await migrateTable("brand_configs", (row) => row.owner_type);
  console.log(
    `\nSummary: scanned ${configs.scanned} external logo URL(s), updated ${configs.changed} row(s).`,
  );
  if (!APPLY && configs.scanned > 0) {
    console.log("Re-run with --apply to perform the migration.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
