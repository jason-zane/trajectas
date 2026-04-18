/**
 * Seed test users for audit-phase-2-full. All rows prefixed
 * `audit-cleanup-*` for easy deletion via `audit-cleanup-users.mjs`.
 *
 * Outputs magic links the Playwright harness can use to log in without OTP email.
 *
 * Usage: node scripts/audit-seed-users.mjs
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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SAMPLE_CLIENT_ID = "00000000-0000-4000-8000-00008a4dc11e"; // "Sample Data"
const DEV_ORIGIN = "http://localhost:3002";

async function createAuthUser(email) {
  const { data: existing } = await admin.auth.admin.listUsers();
  const match = existing?.users.find((u) => u.email === email);
  if (match) {
    console.log(`  auth.user exists: ${match.id}`);
    return match.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(`  created auth.user: ${data.user.id}`);
  return data.user.id;
}

async function upsertProfile({ id, email, firstName, lastName }) {
  const { error } = await admin.from("profiles").upsert(
    {
      id,
      email,
      first_name: firstName,
      last_name: lastName,
      display_name: `${firstName} ${lastName}`,
      is_active: true,
    },
    { onConflict: "id" }
  );
  if (error) throw error;
  console.log(`  upserted profile: ${id}`);
}

async function grantClientMembership({ profileId, clientId, role }) {
  const { data: existing } = await admin
    .from("client_memberships")
    .select("id")
    .eq("profile_id", profileId)
    .eq("client_id", clientId)
    .is("revoked_at", null)
    .maybeSingle();

  if (existing) {
    console.log(`  client_membership exists: ${existing.id}`);
    return existing.id;
  }

  const { data, error } = await admin
    .from("client_memberships")
    .insert({
      profile_id: profileId,
      client_id: clientId,
      role,
      is_default: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  console.log(`  created client_membership: ${data.id}`);
  return data.id;
}

async function mintOtp(email) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${DEV_ORIGIN}/auth/callback` },
  });
  if (error) throw error;
  return {
    actionLink: data.properties.action_link,
    emailOtp: data.properties.email_otp,
  };
}

async function seedUser(spec) {
  console.log(`\n=== ${spec.label} (${spec.email}) ===`);
  const userId = await createAuthUser(spec.email);
  await upsertProfile({
    id: userId,
    email: spec.email,
    firstName: spec.firstName,
    lastName: spec.lastName,
  });
  if (spec.clientId) {
    await grantClientMembership({
      profileId: userId,
      clientId: spec.clientId,
      role: spec.role,
    });
  }
  const otp = await mintOtp(spec.email);
  return { userId, ...otp };
}

async function main() {
  const clientUser = await seedUser({
    label: "CLIENT PORTAL USER",
    email: "audit-cleanup-client@trajectas.test",
    firstName: "Audit",
    lastName: "Client",
    clientId: SAMPLE_CLIENT_ID,
    role: "admin",
  });

  console.log("\n\n=============================================");
  console.log("AUTH (use these in Playwright to sign in via /login)");
  console.log("=============================================\n");
  console.log(`CLIENT EMAIL: audit-cleanup-client@trajectas.test`);
  console.log(`CLIENT OTP:   ${clientUser.emailOtp}`);
  console.log(`CLIENT LINK:  ${clientUser.actionLink}\n`);
  console.log("After you're done, run: node scripts/audit-cleanup-users.mjs");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
