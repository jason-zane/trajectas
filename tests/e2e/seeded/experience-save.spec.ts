import { expect, test } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./auth";
import { seededIds } from "./fixtures";

/**
 * Regression guard: the seeded admin is an ORG-ADMIN of the campaign's client
 * (not a platform admin) — the same persona real single-host admins have.
 * Saving a campaign experience must work for them. It previously threw an
 * AuthorizationError because the save actions gated on platform-admin only.
 */
test.describe("seeded campaign experience save", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test("org-admin can save campaign experience edits", async ({ page }) => {
    await page.goto(`/campaigns/${seededIds.activeCampaignId}/experience`);

    const saveBtn = page.getByRole("button", { name: "Save Changes" });
    await expect(saveBtn).toBeVisible();

    // Dirty the form by appending a space to the first editable text field.
    const firstField = page.locator('input[type="text"], textarea').first();
    await firstField.click();
    await firstField.press("End");
    await firstField.pressSequentially(" ");

    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // The save must succeed for an org-admin of the campaign's client.
    await expect(page.getByText("Experience template saved")).toBeVisible({
      timeout: 15000,
    });
  });
});
