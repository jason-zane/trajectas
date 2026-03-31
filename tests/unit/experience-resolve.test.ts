import { describe, expect, it } from "vitest";
import {
  getFlowOrder,
  getPageContent,
  isPageEnabled,
  resolveTemplate,
} from "@/lib/experience/resolve";
import { DEFAULT_PAGE_CONTENT } from "@/lib/experience/defaults";
import type { ExperienceTemplate, ExperienceTemplateRecord } from "@/lib/experience/types";

function createRecord(
  overrides: Partial<ExperienceTemplateRecord> = {}
): ExperienceTemplateRecord {
  return {
    id: "template-1",
    ownerType: "platform",
    ownerId: null,
    pageContent: {},
    flowConfig: {},
    demographicsConfig: { fields: [] },
    customPageContent: {},
    privacyUrl: null,
    termsUrl: null,
    createdAt: "2026-03-31T00:00:00.000Z",
    updatedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

function createTemplate(overrides: Partial<ExperienceTemplate> = {}): ExperienceTemplate {
  return {
    pageContent: {},
    flowConfig: {
      join: { enabled: true, order: 10 },
      welcome: { enabled: true, order: 20 },
      consent: { enabled: true, order: 30 },
      demographics: { enabled: false, order: 40 },
      review: { enabled: true, order: 110 },
      complete: { enabled: true, order: 120 },
      report: { enabled: false, order: 130, reportMode: "holding" },
      expired: { enabled: true, order: 999 },
    },
    demographicsConfig: { fields: [] },
    customPageContent: {},
    ...overrides,
  };
}

describe("experience template resolution", () => {
  it("merges platform and campaign overrides on top of default content", () => {
    const platform = createRecord({
      pageContent: {
        welcome: {
          ...DEFAULT_PAGE_CONTENT.welcome,
          heading: "Platform Welcome",
        },
      },
      flowConfig: {
        consent: { enabled: true, order: 28 },
        customPages: [{ id: "culture", label: "Culture", enabled: true, order: 35 }],
      },
      demographicsConfig: {
        fields: [
          {
            key: "department",
            enabled: true,
            required: false,
            label: "Department",
            type: "text",
          },
        ],
      },
      customPageContent: {
        culture: {
          heading: "Culture",
          body: "Platform-owned culture page",
          buttonLabel: "Continue",
        },
      },
      privacyUrl: "https://platform.talentfit.test/privacy",
    });

    const campaign = createRecord({
      ownerType: "campaign",
      ownerId: "campaign-1",
      pageContent: {
        welcome: {
          ...DEFAULT_PAGE_CONTENT.welcome,
          heading: "Platform Welcome",
          body: "Campaign-specific welcome copy",
        },
      },
      flowConfig: {
        consent: { enabled: true, order: 26 },
        customPages: [{ id: "team-fit", label: "Team Fit", enabled: true, order: 32 }],
      },
      demographicsConfig: { fields: [] },
      customPageContent: {
        "team-fit": {
          heading: "Team Fit",
          body: "Campaign-owned custom page",
          buttonLabel: "Continue",
        },
      },
      termsUrl: "https://campaign.talentfit.test/terms",
    });

    const template = resolveTemplate(platform, campaign);
    const welcome = getPageContent(template, "welcome");

    expect(welcome.heading).toBe("Platform Welcome");
    expect(welcome.body).toBe("Campaign-specific welcome copy");
    expect(template.flowConfig.consent).toEqual({ enabled: true, order: 26 });
    expect(template.demographicsConfig.fields).toHaveLength(1);
    expect(template.customPageContent).toMatchObject({
      culture: { heading: "Culture" },
      "team-fit": { heading: "Team Fit" },
    });
    expect(template.flowConfig.customPages).toEqual([
      { id: "team-fit", label: "Team Fit", enabled: true, order: 32 },
    ]);
    expect(template.privacyUrl).toBe("https://platform.talentfit.test/privacy");
    expect(template.termsUrl).toBe("https://campaign.talentfit.test/terms");
  });

  it("derives enabled flow order and falls back to default page content", () => {
    const template = createTemplate({
      flowConfig: {
        join: { enabled: true, order: 10 },
        welcome: { enabled: true, order: 20 },
        consent: { enabled: true, order: 30 },
        demographics: { enabled: false, order: 40 },
        review: { enabled: true, order: 110 },
        complete: { enabled: true, order: 120 },
        report: { enabled: false, order: 130, reportMode: "holding" },
        expired: { enabled: true, order: 999 },
        customPages: [{ id: "prep", label: "Prep", enabled: true, order: 25 }],
      },
    });

    expect(getFlowOrder(template)).toEqual([
      "welcome",
      "prep",
      "consent",
      "review",
      "complete",
    ]);
    expect(isPageEnabled(template, "runner")).toBe(true);
    expect(isPageEnabled(template, "report")).toBe(false);
    expect(getPageContent(template, "complete")).toEqual(DEFAULT_PAGE_CONTENT.complete);
  });
});
