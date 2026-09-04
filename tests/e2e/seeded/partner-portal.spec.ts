import { expect, test } from "@playwright/test";

import { PARTNER_STORAGE_STATE } from "./auth";
import { seededIds } from "./fixtures";

/**
 * The partner-portal journey: everything a partner admin must be able to do for
 * one of their own clients, end to end, plus the boundary that says they cannot
 * do it for anyone else's.
 *
 * Authenticated as the seeded partner admin (see supabase/seed.sql) — an admin
 * of "Seeded Advisory Group", which owns "Seeded Client Co". This actor holds
 * NO client membership, so everything below is reached through the partner.
 */
test.describe("seeded partner portal", () => {
  test.use({ storageState: PARTNER_STORAGE_STATE });

  test("dashboard reads as a portfolio, with the partner's allocation", async ({
    page,
  }) => {
    await page.goto("/partner/dashboard");

    await expect(
      page.getByRole("heading", { name: /What.s moving across your portfolio/i })
    ).toBeVisible();

    // The allocation section is the number a partner runs their business on.
    await expect(page.getByText("Your allocation")).toBeVisible();
    await expect(
      page.getByText("Seeded Leadership Assessment", { exact: true }).first()
    ).toBeVisible();
    // Seeded allocation is capped at 25; usage comes from the seeded campaign.
    await expect(page.getByText(/of 25 used/)).toBeVisible();
  });

  test("client list links into the console, which has no Billing tab", async ({
    page,
  }) => {
    await page.goto("/partner/clients");
    await expect(page.getByRole("heading", { name: "Client portfolio" })).toBeVisible();

    await page.getByRole("link", { name: "Open Seeded Client Co", exact: true }).click();
    await expect(page).toHaveURL(/\/partner\/clients\/seeded-client-co\/overview$/);

    for (const tab of [
      "Overview",
      "Details",
      "Assessments",
      "Reports",
      "Users",
      "Branding",
      "Settings",
    ]) {
      await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }
    // Billing is platform-only (D13).
    await expect(page.getByRole("tab", { name: "Billing" })).toHaveCount(0);
  });

  test("assessments tab surfaces the partner allocation and refuses a quota above the cap", async ({
    page,
  }) => {
    await page.goto("/partner/clients/seeded-client-co/assessments");
    await expect(page.getByRole("heading", { name: "Assessments" })).toBeVisible();

    await page.getByRole("button", { name: "Assign Assessment" }).click();
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: /Seeded Leadership Assessment/ }).click();

    // The allocation is capped at 25, so a numeric quota is required...
    await expect(page.getByText(/Partner allocation:/)).toBeVisible();
    const submit = page.getByRole("button", { name: "Assign assessment" });
    await expect(submit).toBeDisabled();

    // ...one above the cap is refused before submit...
    await page.getByLabel("Quota limit").fill("40");
    await expect(
      page.getByText("Quota cannot exceed the partner allocation of 25.")
    ).toBeVisible();
    await expect(submit).toBeDisabled();

    // ...and one within it is accepted.
    await page.getByLabel("Quota limit").fill("10");
    await expect(submit).toBeEnabled();

    // Deliberately not submitting: this spec runs against a seeded database
    // that persists between local runs, and a completed assignment would make
    // the next run's dialog empty. The write path (pool rule, quota cap, the
    // database trigger) is covered by tests/integration/partner-managed-clients.
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("campaign console has the full tab set", async ({ page }) => {
    await page.goto(`/partner/campaigns/${seededIds.activeCampaignId}/overview`);

    await expect(
      page.getByRole("heading", { name: "Seeded Leadership Campaign" })
    ).toBeVisible();
    for (const tab of [
      "Overview",
      "Assessments",
      "Participants",
      "Experience",
      "Branding",
      "Settings",
    ]) {
      await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }
  });

  test("another partner's client is not reachable", async ({ page }) => {
    // A client that really exists, owned by Rival Advisory Group (see
    // supabase/seed.sql). A made-up slug would only exercise the "no such row"
    // branch and would still pass if every foreign client were reachable.
    //
    // Assert on what the visitor sees rather than the HTTP status: a
    // layout-level notFound() streams its page after headers are sent, so the
    // status is not a reliable signal here.
    await page.goto("/partner/clients/rival-client-co/overview");

    await expect(page.getByText("Rival Client Co")).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveCount(0);
    await expect(
      page.getByText("Page not found").or(page.getByText(/not authoriz|unauthoriz/i)).first()
    ).toBeVisible();
  });

  test("an unknown client slug is not reachable either", async ({ page }) => {
    await page.goto("/partner/clients/does-not-exist/overview");
    await expect(page.getByText("Page not found")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveCount(0);
  });
});
