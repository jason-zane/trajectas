/**
 * Deep-dive captures for the remaining audit gaps:
 * 1. Participant flow with all stages enabled (consent, demographics, review, report)
 * 2. BrandEditor in enabled state
 * 3. CampaignForm state transitions
 * 4. FlowEditor keyboard navigation verification
 *
 * Modifies flow_config on EPP Test Campaign + can_customize_branding on Sample Data
 * temporarily, reverts at the end. Cleans up all seed data.
 *
 * Usage: node scripts/audit-deep-dives.mjs
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DEV_ORIGIN = "http://localhost:3002";
const CLIENT_EMAIL = "audit-cleanup-client@trajectas.test";
const EPP_CAMPAIGN_ID = "2354fec6-b9a6-45d0-88e6-131299c8e420";
const SAMPLE_CLIENT_ID = "00000000-0000-4000-8000-00008a4dc11e";

const OUT_DIR = resolve(process.cwd(), "docs/audit/screenshots/phase-2-full");
mkdirSync(resolve(OUT_DIR, "deep-dives"), { recursive: true });

async function mintOtp(email) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${DEV_ORIGIN}/auth/callback` },
  });
  if (error) throw error;
  return data.properties.email_otp;
}

async function signInClient(page) {
  const otp = await mintOtp(CLIENT_EMAIL);
  console.log(`  minted OTP: ${otp}`);
  await page.goto(`${DEV_ORIGIN}/login`);
  await page.getByPlaceholder(/you@|email/i).fill(CLIENT_EMAIL);
  await page.getByRole("button", { name: /send sign-in code/i }).click();
  await page.waitForTimeout(2000);
  const otpInput = page.getByPlaceholder("000000");
  await otpInput.waitFor({ state: "visible", timeout: 10000 });
  await otpInput.click();
  await otpInput.pressSequentially(otp, { delay: 50 });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /verify/i }).click();
  await page.waitForTimeout(4000);
  if (!/\/client\//.test(page.url())) {
    await page.goto(`${DEV_ORIGIN}/client/dashboard`);
    await page.waitForTimeout(2000);
  }
  console.log(`  signed in`);
}

async function snap(page, name, { waitMs = 2000 } = {}) {
  await page.waitForTimeout(waitMs);
  const file = resolve(OUT_DIR, "deep-dives", name);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  captured ${name}`);
}

async function modifyEppFlow(enabled) {
  const { data: existing, error: e1 } = await admin
    .from("experience_templates")
    .select("flow_config")
    .eq("owner_type", "campaign")
    .eq("owner_id", EPP_CAMPAIGN_ID)
    .is("deleted_at", null)
    .single();
  if (e1) throw e1;
  const newConfig = structuredClone(existing.flow_config);
  newConfig.consent.enabled = enabled;
  newConfig.demographics.enabled = enabled;
  newConfig.review.enabled = enabled;
  // Leave report disabled - needs a released snapshot anyway
  const { error } = await admin
    .from("experience_templates")
    .update({ flow_config: newConfig })
    .eq("owner_type", "campaign")
    .eq("owner_id", EPP_CAMPAIGN_ID);
  if (error) throw error;
  return existing.flow_config;
}

async function restoreEppFlow(original) {
  const { error } = await admin
    .from("experience_templates")
    .update({ flow_config: original })
    .eq("owner_type", "campaign")
    .eq("owner_id", EPP_CAMPAIGN_ID);
  if (error) throw error;
  console.log("  EPP flow_config restored");
}

async function toggleBranding(enabled) {
  const { error } = await admin
    .from("clients")
    .update({ can_customize_branding: enabled })
    .eq("id", SAMPLE_CLIENT_ID);
  if (error) throw error;
}

async function seedParticipant() {
  const { data, error } = await admin
    .from("campaign_participants")
    .insert({
      campaign_id: EPP_CAMPAIGN_ID,
      email: `audit-cleanup-deepdive-${Date.now()}@trajectas.test`,
      first_name: "DeepDive",
      last_name: "Audit",
      access_token:
        "audit-cleanup-dd-" + Math.random().toString(36).slice(2, 18),
      status: "invited",
      invited_at: new Date().toISOString(),
    })
    .select("access_token")
    .single();
  if (error) throw error;
  return data.access_token;
}

async function cleanupParticipants() {
  await admin
    .from("campaign_participants")
    .delete()
    .ilike("access_token", "audit-cleanup-dd-%");
}

const VP_DESKTOP = { width: 1280, height: 800 };
const VP_MOBILE = { width: 375, height: 812 };

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VP_DESKTOP });
  const page = await ctx.newPage();

  // ---- Enable stages + branding temporarily ----
  console.log("\n=== Modifying test data ===");
  const originalFlow = await modifyEppFlow(true);
  await toggleBranding(true);
  console.log("  EPP stages enabled; Sample Data branding enabled");

  try {
    // ---- Participant: all stages enabled (mobile) ----
    console.log("\n=== Participant flow: all stages ===");
    await page.setViewportSize(VP_MOBILE);
    const token = await seedParticipant();
    console.log(`  seeded token: ${token}`);
    const base = `${DEV_ORIGIN}/assess/${token}`;

    await page.goto(`${base}/welcome`);
    await snap(page, "p-01-welcome-mobile.png");

    // Click Begin
    try {
      await page.locator("button:has-text('Begin')").first().click({ timeout: 5000 });
      await page.waitForTimeout(2500);
      await snap(page, "p-02-consent-mobile.png");
    } catch {
      console.log("  Begin click failed — capturing consent by direct nav");
      await page.goto(`${base}/consent`);
      await snap(page, "p-02-consent-mobile.png");
    }

    // Try to advance past consent (likely a checkbox + button)
    try {
      await page.locator("input[type=checkbox]").first().check({ timeout: 3000 });
      await page.locator("button:has-text('Continue'), button:has-text('Agree')").first().click({ timeout: 3000 });
      await page.waitForTimeout(2500);
      await snap(page, "p-03-demographics-mobile.png");
    } catch {
      console.log("  consent advance failed — direct nav to demographics");
      await page.goto(`${base}/demographics`);
      await snap(page, "p-03-demographics-mobile.png");
    }

    // Direct nav to review
    await page.goto(`${base}/review`);
    await snap(page, "p-04-review-mobile.png");

    // ---- BrandEditor in enabled state (desktop) ----
    console.log("\n=== BrandEditor (enabled) ===");
    await page.setViewportSize(VP_DESKTOP);
    await signInClient(page);
    await page.goto(`${DEV_ORIGIN}/client/settings/brand/client`);
    await snap(page, "b-01-brand-enabled-desktop.png", { waitMs: 4000 });

    // ---- CampaignForm state transitions (desktop) ----
    console.log("\n=== CampaignForm state transitions ===");
    await page.goto(`${DEV_ORIGIN}/client/campaigns/create`);
    await snap(page, "cf-01-empty-desktop.png");

    // Fill title, check slug auto-fills
    const titleInput = page.getByRole("textbox", { name: /title/i }).first();
    await titleInput.fill("Audit Deep Dive Test");
    await page.waitForTimeout(1000);
    await snap(page, "cf-02-title-filled-desktop.png");

    // Submit without required fields filled (test validation)
    // Then fill everything
    await page
      .getByRole("textbox", { name: /description/i })
      .first()
      .fill("A test campaign for audit deep-dive purposes.");
    await page.waitForTimeout(500);
    await snap(page, "cf-03-all-filled-desktop.png");

    // Click Create Campaign — but we don't want to actually create one, so go back instead
    // Capture the submit button state
    const submitBtn = page.getByRole("button", { name: /create campaign/i });
    if (await submitBtn.isVisible()) {
      console.log("  create button visible; not clicking to avoid creating campaign");
    }

    // ---- FlowEditor keyboard a11y (desktop) ----
    console.log("\n=== FlowEditor keyboard a11y ===");
    await page.goto(`${DEV_ORIGIN}/client/campaigns/${EPP_CAMPAIGN_ID}/experience`);
    await page.waitForTimeout(4000);
    await snap(page, "fe-01-default-desktop.png");

    // Tab into the page and look at focus flow
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    await page.keyboard.press("Tab");
    await snap(page, "fe-02-tab-focus-desktop.png");

    // Try to select a page in the list + attempt keyboard reorder
    // React dnd / dndkit usually supports space+arrow
    await page.keyboard.press("Tab"); // more tabs to get into list area
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    await snap(page, "fe-03-more-tab-desktop.png");
  } finally {
    // ---- Revert test data ----
    console.log("\n=== Reverting test data ===");
    await restoreEppFlow(originalFlow);
    await toggleBranding(false);
    await cleanupParticipants();
    console.log("  all test changes reverted");
  }

  await browser.close();
  console.log("\nDone.");
}

run().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
