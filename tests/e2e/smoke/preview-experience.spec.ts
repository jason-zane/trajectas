import { expect, test } from "@playwright/test";

test.describe("preview experience", () => {
  test("shows an empty state when no preview data exists", async ({ page }) => {
    await page.goto("/preview/experience");

    await expect(page.getByText("No preview data available.")).toBeVisible();
    await expect(page.getByText("Return to the experience editor and try again.")).toBeVisible();
  });
});
