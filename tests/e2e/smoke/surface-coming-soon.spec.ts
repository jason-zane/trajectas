import { expect, test } from "@playwright/test";

test.describe("surface coming soon", () => {
  test("renders the public fallback surface", async ({ page, baseURL }) => {
    // The single-host harness uses local pathname routing. This GET-only
    // public fallback case uses Chromium's loopback .localhost test domain;
    // localhost itself is the admin surface under the existing routing rules.
    const url = new URL("/surface-coming-soon", baseURL);
    url.hostname = "public.localhost";
    await page.goto(url.href);

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
});
