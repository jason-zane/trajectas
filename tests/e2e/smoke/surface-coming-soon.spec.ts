import { expect, test } from "@playwright/test";

test.describe("surface coming soon", () => {
  test("renders the public fallback surface", async ({ page }) => {
    await page.goto("/surface-coming-soon");

    await expect(
      page.getByRole("heading", { name: "This surface is reserved but not built yet." })
    ).toBeVisible();
    await expect(page.getByText("Public Site")).toBeVisible();
    await expect(
      page.getByText(
        "Marketing and public entry flows. The host boundary is active now so the route cannot fall through to the wrong workspace while the dedicated UI is still being implemented."
      )
    ).toBeVisible();
  });

  test("respects the routed surface header", async ({ browser }) => {
    const context = await browser.newContext({
      extraHTTPHeaders: {
        "x-trajectas-surface": "partner",
      },
    });
    const page = await context.newPage();

    await page.goto("/surface-coming-soon");
    await expect(page.getByText("Partner Portal")).toBeVisible();

    await context.close();
  });
});
