/**
 * Focused keyboard-navigation audit of the FlowEditor using Sample Data's
 * Preview Sample Personality Index campaign (owned by our test user's client).
 *
 * Captures:
 *   - Default state
 *   - After Tab cycling (see what gains focus)
 *   - After attempting drag-reorder via keyboard (arrow keys while focused)
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
const SAMPLE_CAMPAIGN_ID = "0d1e6c21-d749-4b35-a431-7581e62862d6";

const OUT_DIR = resolve(
  process.cwd(),
  "docs/audit/screenshots/phase-2-full/deep-dives"
);
mkdirSync(OUT_DIR, { recursive: true });

async function signIn(page) {
  const { data } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: CLIENT_EMAIL,
    options: { redirectTo: `${DEV_ORIGIN}/auth/callback` },
  });
  const otp = data.properties.email_otp;
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
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await signIn(page);
  console.log("signed in");

  await page.goto(`${DEV_ORIGIN}/client/campaigns/${SAMPLE_CAMPAIGN_ID}/experience`);
  await page.waitForTimeout(5000);
  await page.screenshot({
    path: resolve(OUT_DIR, "fe-01-default-correct-desktop.png"),
    fullPage: true,
  });
  console.log("captured default state");

  // Click somewhere neutral, then Tab through the page 10 times and capture
  await page.locator("body").click();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(150);
  }
  await page.screenshot({
    path: resolve(OUT_DIR, "fe-02-after-10-tabs-desktop.png"),
    fullPage: true,
  });
  console.log("captured after 10 tabs");

  // Get the current focused element description
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return "none";
    return {
      tag: el.tagName,
      text: el.textContent?.trim().slice(0, 80),
      aria: el.getAttribute("aria-label"),
      role: el.getAttribute("role"),
      dataSlot: el.getAttribute("data-slot"),
      cls: el.className?.slice?.(0, 100),
    };
  });
  console.log("after 10 tabs, focused:", JSON.stringify(focused));

  // Continue tabbing another 15 to try to reach page list
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(120);
  }
  const focused2 = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return "none";
    return {
      tag: el.tagName,
      text: el.textContent?.trim().slice(0, 80),
      aria: el.getAttribute("aria-label"),
      role: el.getAttribute("role"),
      dataSlot: el.getAttribute("data-slot"),
    };
  });
  console.log("after 25 tabs, focused:", JSON.stringify(focused2));
  await page.screenshot({
    path: resolve(OUT_DIR, "fe-03-after-25-tabs-desktop.png"),
    fullPage: true,
  });

  // Try space to activate (common dnd-kit pattern), then arrow to move
  await page.keyboard.press("Space");
  await page.waitForTimeout(400);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(400);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(400);
  await page.screenshot({
    path: resolve(OUT_DIR, "fe-04-after-space-arrows-desktop.png"),
    fullPage: true,
  });
  console.log("captured after space+arrows attempt");

  // Release
  await page.keyboard.press("Space");
  await page.waitForTimeout(400);

  await browser.close();
  console.log("done");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
