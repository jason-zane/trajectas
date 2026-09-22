import { expect, test } from "@playwright/test";

test("public examples and supporting navigation form one journey", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Understanding people");
  await page.getByRole("button", { name: "Development", exact: true }).click();
  await expect(page.locator(".ph-example-context h2")).toHaveText("A manager taking on more");
  await page.getByRole("link", { name: "Explore Role Builder", exact: true }).click();
  await expect(page).toHaveURL(/role-builder/);
  await expect(page.locator(".px-hero h1")).toContainText("Every role is different");
  await expect(page.locator(".px-capability-set li")).toHaveCount(6);
  await page.getByLabel("Choose an example").selectOption("2");
  await expect(page.locator(".px-example-heading h2")).toHaveText("Customer Success Lead");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "How it works" }).click();
  await expect(page).toHaveURL(/how-it-works/);
  await expect(page.locator("h1")).toContainText("Context first");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Contact" }).click();
  await expect(page.getByLabel("Your message")).toBeVisible();
});
for (const [from, to] of [["/classic", "/"], ["/capability-assessment", "/how-it-works"], ["/psychometric-assessment", "/how-it-works"], ["/performance-and-outcomes", "/for-teams"]]) {
  test(`legacy ${from} redirects into the current site`, async ({ page }) => {
    await page.goto(from);
    await expect(page).toHaveURL(new URL(to, page.url()).href);
    await expect(page.locator(".px-header")).toBeVisible();
  });
}
