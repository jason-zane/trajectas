/**
 * Delete all audit-cleanup-* test users + memberships + profiles.
 * Idempotent. Usage: node scripts/audit-cleanup-users.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const targets = users.users.filter((u) =>
    u.email?.startsWith("audit-cleanup-")
  );

  for (const user of targets) {
    console.log(`Deleting ${user.email} (${user.id})`);
    await admin
      .from("client_memberships")
      .delete()
      .eq("profile_id", user.id);
    await admin.from("profiles").delete().eq("id", user.id);
    await admin.auth.admin.deleteUser(user.id);
  }

  await admin
    .from("campaign_participants")
    .delete()
    .ilike("access_token", "audit-cleanup-%");

  console.log(`\nCleaned up ${targets.length} user(s) + audit-cleanup participants.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
