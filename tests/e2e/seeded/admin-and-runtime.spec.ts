import { expect, test } from "@playwright/test";
import { seededIds, seededTokens } from "./fixtures";

test.describe("seeded admin workspace", () => {
  test("shows deterministic seeded campaigns on the dashboard", async ({ page }) => {
    await page.goto("/campaigns");

    await expect(page.getByRole("heading", { name: "Campaigns" })).toBeVisible();
    await expect(page.getByText("Seeded Leadership Campaign")).toBeVisible();
    await expect(page.getByText("Seeded Closed Campaign")).toBeVisible();
    await expect(page.getByText("Seeded Client Co").first()).toBeVisible();
  });

  test("renders seeded campaign overview stats and actions", async ({ page }) => {
    await page.goto(`/campaigns/${seededIds.activeCampaignId}/overview`);

    await expect(page.getByText("Overall Completion")).toBeVisible();
    await expect(page.getByText("1 of 4 participants completed")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
    await expect(page.getByText("Timeline")).toBeVisible();
  });

  test("lists seeded participants and opens the completed participant detail view", async ({
    page,
  }) => {
    await page.goto("/participants");

    await expect(page.getByRole("heading", { name: "Participants" })).toBeVisible();
    await expect(page.getByText("Avery Invited")).toBeVisible();
    await expect(page.getByText("Blake Progress")).toBeVisible();
    await expect(page.getByText("Casey Completed")).toBeVisible();
    await expect(page.getByText("River Revoked")).toBeVisible();

    await page.goto(`/participants/${seededIds.completedParticipantId}`);

    await expect(page.getByRole("heading", { name: "Casey Completed" })).toBeVisible();
    await expect(page.getByText("Assessment Sessions")).toBeVisible();
    await expect(page.getByText("Seeded Leadership Campaign")).toBeVisible();
  });
});

test.describe("seeded participant runtime", () => {
  test("routes an invited participant into the welcome step", async ({ page }) => {
    await page.goto(`/assess/${seededTokens.invited}`);

    await expect(page).toHaveURL(new RegExp(`/assess/${seededTokens.invited}/welcome$`));
    await expect(page.getByRole("heading", { name: "Seeded Leadership Campaign" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Begin Assessment" })).toBeVisible();
  });

  test("routes an in-progress participant back into the active section", async ({ page }) => {
    await page.goto(`/assess/${seededTokens.inProgress}`);

    await expect(page).toHaveURL(new RegExp(`/assess/${seededTokens.inProgress}/section/0$`));
    await expect(page.getByText("Seeded Leadership Assessment")).toBeVisible();
    await expect(
      page.getByText(
        "I find it easy to see situations from other people's perspectives, even when I disagree with them."
      )
    ).toBeVisible();
  });

  test("routes a completed participant to the completion screen", async ({ page }) => {
    await page.goto(`/assess/${seededTokens.completed}`);

    await expect(page).toHaveURL(new RegExp(`/assess/${seededTokens.completed}/complete$`));
    await expect(page.getByRole("heading", { name: "Thank You" })).toBeVisible();
  });

  test("rejects revoked and closed campaign tokens", async ({ page }) => {
    await page.goto(`/assess/${seededTokens.revoked}`);
    await expect(page).toHaveURL(/\/assess\/expired$/);
    await expect(page.getByRole("heading", { name: "Link Expired" })).toBeVisible();

    await page.goto(`/assess/${seededTokens.closedCampaign}`);
    await expect(page).toHaveURL(/\/assess\/expired$/);
    await expect(page.getByRole("heading", { name: "Link Expired" })).toBeVisible();
  });
});
