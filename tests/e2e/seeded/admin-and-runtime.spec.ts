import { expect, test } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./auth";
import { seededIds, seededTokens } from "./fixtures";

test.describe("seeded admin workspace", () => {
  // Authenticated as the seeded admin, whose session is minted by the
  // seeded-setup project (see auth.ts / admin-auth.setup.ts). The
  // participant-runtime block below intentionally stays unauthenticated.
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test("shows deterministic seeded campaigns on the dashboard", async ({ page }) => {
    await page.goto("/campaigns");

    await expect(page.getByRole("heading", { name: "Campaigns" })).toBeVisible();
    // Each row renders both an inner anchor (aria-label "Open <title>") and a
    // whole-row link whose name embeds the title; match the anchor exactly.
    await expect(
      page.getByRole("link", { name: "Open Seeded Leadership Campaign", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open Seeded Closed Campaign", exact: true })
    ).toBeVisible();
    await expect(page.getByText("Seeded Client Co").first()).toBeVisible();
  });

  test("renders seeded campaign overview stats and actions", async ({ page }) => {
    await page.goto(`/campaigns/${seededIds.activeCampaignId}/overview`);

    await expect(page.getByText("Overall Completion")).toBeVisible();
    await expect(page.getByText("1 of 4 participants completed")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
    await expect(page.getByText("Started")).toBeVisible();
  });

  test("lists seeded participants and opens the completed participant detail view", async ({
    page,
  }) => {
    await page.goto("/participants");

    await expect(page.getByRole("heading", { name: "Participants" })).toBeVisible();
    // Same inner-anchor vs whole-row-link ambiguity as the campaigns table.
    await expect(
      page.getByRole("link", { name: "Open Avery Invited", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open Blake Progress", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open Casey Completed", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open River Revoked", exact: true })
    ).toBeVisible();

    await page.goto(`/participants/${seededIds.completedParticipantId}`);

    await expect(page.getByRole("heading", { name: "Casey Completed" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Sessions" })).toBeVisible();
    // Campaign title appears in the header subtitle (and again in the overview panel).
    await expect(page.getByText("Seeded Leadership Campaign").first()).toBeVisible();
  });
});

test.describe("seeded participant runtime", () => {
  test("routes an invited participant into the welcome step", async ({ page }) => {
    await page.goto(`/assess/${seededTokens.invited}`);

    await expect(page).toHaveURL(new RegExp(`/assess/${seededTokens.invited}/welcome$`));
    // Dark-editorial welcome: campaign title renders as the mono eyebrow,
    // and the serif heading carries the greeting sentence.
    await expect(page.getByText("Seeded Leadership Campaign").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /this is about how you work best/i })
    ).toBeVisible();
    const begin = page.getByRole("link", { name: "Begin assessment" });
    await expect(begin).toBeVisible();
    await expect(begin).toHaveAttribute("href", new RegExp(`^/assess/${seededTokens.invited}/`));
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
