/**
 * Bulk-capture screenshots for audit phase 2-full.
 *
 * Uses Playwright directly (not MCP) so base64 images don't balloon the agent context.
 * Signs in via OTP (minted from the seeded test user).
 *
 * Usage:
 *   node scripts/audit-capture.mjs client-desktop
 *   node scripts/audit-capture.mjs client-mobile
 *   node scripts/audit-capture.mjs participant-mobile
 *
 * Requires chromium from playwright package.
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync } from "fs";
import { resolve } from "path";

// Load .env.local
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
const CAMPAIGN_ID = "0d1e6c21-d749-4b35-a431-7581e62862d6";
const PARTICIPANT_ID = "4e1dd571-9d82-4bf4-8ebd-7b840ef716bd";
const SESSION_ID = "32ebc7c4-d598-4610-aa7b-13fc3e195a89";

const OUT_DIR = resolve(process.cwd(), "docs/audit/screenshots/phase-2-full");
mkdirSync(resolve(OUT_DIR, "client"), { recursive: true });
mkdirSync(resolve(OUT_DIR, "participant"), { recursive: true });

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
  // OTP input has placeholder "000000" — use that to target it
  const otpInput = page.getByPlaceholder("000000");
  await otpInput.waitFor({ state: "visible", timeout: 10000 });
  await otpInput.click();
  await otpInput.pressSequentially(otp, { delay: 50 });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /verify/i }).click();
  // verifyOtp runs client-side, sets cookie, then redirects to /auth/callback,
  // which re-checks session and redirects to portal. Give it time.
  await page.waitForTimeout(4000);
  const url = page.url();
  console.log(`  post-verify url: ${url}`);
  if (!/\/client\//.test(url)) {
    // Probably still on callback or had an error; try dashboard directly
    await page.goto(`${DEV_ORIGIN}/client/dashboard`);
    await page.waitForTimeout(2000);
  }
  console.log(`  signed in at ${page.url()}`);
}

async function seedParticipant() {
  // Re-use an existing participant in EPP Test Campaign for mobile capture
  const { data, error } = await admin
    .from("campaign_participants")
    .insert({
      campaign_id: "2354fec6-b9a6-45d0-88e6-131299c8e420", // EPP Test Campaign (has 1 assessment)
      email: "audit-cleanup-participant@trajectas.test",
      first_name: "Audit",
      last_name: "Participant",
      access_token:
        "audit-cleanup-p2f-" + Math.random().toString(36).slice(2, 18),
      status: "invited",
      invited_at: new Date().toISOString(),
    })
    .select("access_token")
    .single();
  if (error) throw error;
  return data.access_token;
}

async function capture(page, name, url, { waitMs = 2500, viewport } = {}) {
  if (viewport) await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(waitMs);
  const file = resolve(OUT_DIR, name);
  mkdirSync(resolve(file, ".."), { recursive: true });
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  captured ${name}`);
}

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 375, height: 812 };

const CLIENT_ROUTES = [
  // slug, path
  ["dashboard", "/client/dashboard"],
  ["campaigns", "/client/campaigns"],
  ["campaigns-create", "/client/campaigns/create"],
  ["campaign-overview", `/client/campaigns/${CAMPAIGN_ID}/overview`],
  ["campaign-assessments", `/client/campaigns/${CAMPAIGN_ID}/assessments`],
  ["campaign-settings", `/client/campaigns/${CAMPAIGN_ID}/settings`],
  ["campaign-experience", `/client/campaigns/${CAMPAIGN_ID}/experience`],
  ["campaign-participants", `/client/campaigns/${CAMPAIGN_ID}/participants`],
  [
    "campaign-participant-detail",
    `/client/campaigns/${CAMPAIGN_ID}/participants/${PARTICIPANT_ID}`,
  ],
  [
    "campaign-session-nested",
    `/client/campaigns/${CAMPAIGN_ID}/participants/${PARTICIPANT_ID}/sessions/${SESSION_ID}`,
  ],
  [
    "campaign-session",
    `/client/campaigns/${CAMPAIGN_ID}/sessions/${SESSION_ID}`,
  ],
  ["participants", "/client/participants"],
  ["assessments", "/client/assessments"],
  ["settings-brand", "/client/settings/brand/client"],
];

async function run(mode) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: mode.includes("mobile") ? MOBILE : DESKTOP,
  });
  const page = await context.newPage();

  if (mode === "client-desktop" || mode === "client-mobile") {
    const viewport = mode === "client-mobile" ? MOBILE : DESKTOP;
    const prefix = mode === "client-mobile" ? "mobile-" : "";
    await signInClient(page);
    for (const [slug, path] of CLIENT_ROUTES) {
      await capture(page, `client/${prefix}${slug}.png`, DEV_ORIGIN + path, {
        viewport,
      });
    }
  } else if (mode === "participant-mobile") {
    await page.setViewportSize(MOBILE);
    const token = await seedParticipant();
    console.log(`  seeded participant token: ${token}`);
    const base = `${DEV_ORIGIN}/assess/${token}`;
    // Walk the flow; welcome → section → review → complete
    await capture(page, "participant/01-welcome-mobile.png", `${base}/welcome`);
    // Begin button → section 0
    await page.locator("button:has-text('Begin')").first().click();
    await page.waitForURL(/\/section\/0/i, { timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: resolve(OUT_DIR, "participant/02-section-q1-mobile.png"),
      fullPage: true,
    });
    console.log("  captured section q1");
    // Click the first answer button to advance (format-agnostic)
    try {
      await page.locator("main button").first().click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: resolve(OUT_DIR, "participant/03-section-q2-mobile.png"),
        fullPage: true,
      });
      console.log("  captured section q2 (after answer)");
    } catch {
      console.log("  skipping q2 capture (click failed)");
    }
    // Navigate to review
    try {
      await capture(page, "participant/04-review-mobile.png", `${base}/review`);
    } catch (err) {
      console.log("  review capture failed:", err.message);
    }
    // Navigate to complete
    try {
      await capture(
        page,
        "participant/05-complete-mobile.png",
        `${base}/complete`
      );
    } catch (err) {
      console.log("  complete capture failed:", err.message);
    }
    // Also capture expired
    await capture(
      page,
      "participant/06-expired-mobile.png",
      `${DEV_ORIGIN}/assess/expired`
    );
    // Also capture join with fake token
    await capture(
      page,
      "participant/07-join-mobile.png",
      `${DEV_ORIGIN}/assess/join/audit-cleanup-fake`
    );
  } else {
    console.error(`Unknown mode: ${mode}`);
    process.exit(1);
  }

  await browser.close();
  console.log("Done.");
}

run(process.argv[2] ?? "client-desktop").catch((err) => {
  console.error(err);
  process.exit(1);
});
