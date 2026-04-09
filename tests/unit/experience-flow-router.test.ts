import { describe, expect, it } from "vitest";
import {
  getFullFlowOrder,
  getNextFlowUrl,
  getPostSectionsUrl,
  getPreviousFlowUrl,
  SECTIONS_SENTINEL,
} from "@/lib/experience/flow-router";
import type { ExperienceTemplate } from "@/lib/experience/types";

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
      report: { enabled: true, order: 130, reportMode: "holding" },
      expired: { enabled: true, order: 999 },
      customPages: [
        { id: "prep", label: "Prep", enabled: true, order: 25 },
        { id: "debrief", label: "Debrief", enabled: true, order: 125 },
      ],
    },
    demographicsConfig: { fields: [] },
    customPageContent: {},
    ...overrides,
  };
}

describe("experience flow router", () => {
  it("builds the full flow order around the sections sentinel", () => {
    const flow = getFullFlowOrder(createTemplate());

    expect(flow).toEqual([
      "join",
      "welcome",
      "prep",
      "consent",
      SECTIONS_SENTINEL,
      "review",
      "complete",
      "debrief",
      "report",
    ]);
  });

  it("navigates forward and backward around sections", () => {
    const template = createTemplate();

    expect(getNextFlowUrl(template, "consent", "token-123")).toBe(
      "/assess/token-123/assessment-intro/0"
    );
    expect(getNextFlowUrl(template, SECTIONS_SENTINEL, "token-123")).toBe(
      "/assess/token-123/review"
    );
    expect(getPreviousFlowUrl(template, "welcome", "token-123")).toBe(
      "/assess/token-123"
    );
    expect(getPreviousFlowUrl(template, "review", "token-123")).toBeNull();
    expect(getPostSectionsUrl(template, "token-123")).toBe("/assess/token-123/review");
  });

  it("falls back to complete when there are no post-section pages", () => {
    const template = createTemplate({
      flowConfig: {
        join: { enabled: true, order: 10 },
        welcome: { enabled: true, order: 20 },
        consent: { enabled: false, order: 30 },
        demographics: { enabled: false, order: 40 },
        review: { enabled: false, order: 110 },
        complete: { enabled: false, order: 120 },
        report: { enabled: false, order: 130, reportMode: "holding" },
        expired: { enabled: true, order: 999 },
      },
    });

    expect(getPostSectionsUrl(template, "token-123")).toBe("/assess/token-123/complete");
  });
});
