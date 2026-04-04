import { describe, expect, it } from "vitest";
import {
  getCampaignAccessError,
  getParticipantAccessError,
} from "@/lib/assess/access";

describe("assessment access helpers", () => {
  it("returns campaign access errors for deleted, unopened, and closed campaigns", () => {
    const now = new Date("2026-03-31T12:00:00.000Z");

    expect(
      getCampaignAccessError({ status: "active", deletedAt: "2026-03-30T00:00:00.000Z" }, now)
    ).toBe("Campaign not found or unavailable.");
    expect(
      getCampaignAccessError({ status: "draft" }, now)
    ).toBe("This campaign is not currently accepting responses.");
    expect(
      getCampaignAccessError({ status: "active", opensAt: "2026-04-01T00:00:00.000Z" }, now)
    ).toBe("This campaign has not opened yet.");
    expect(
      getCampaignAccessError({ status: "active", closesAt: "2026-03-01T00:00:00.000Z" }, now)
    ).toBe("This campaign has closed.");
  });

  it("blocks paused campaigns with a specific message", () => {
    const now = new Date("2026-03-31T12:00:00.000Z");
    expect(getCampaignAccessError({ status: "paused" }, now)).toBe(
      "This campaign is currently paused. Please try again later."
    );
  });

  it("allows active campaigns and flags revoked participant states", () => {
    const now = new Date("2026-03-31T12:00:00.000Z");

    expect(getCampaignAccessError({ status: "active" }, now)).toBeNull();
    expect(getParticipantAccessError("withdrawn")).toBe(
      "Your access to this campaign has been revoked."
    );
    expect(getParticipantAccessError("expired")).toBe(
      "Your access to this campaign has been revoked."
    );
    expect(getParticipantAccessError("completed")).toBeNull();
  });
});
