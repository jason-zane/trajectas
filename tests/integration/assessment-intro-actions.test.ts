import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  canManageCampaign: vi.fn(),
  requireAssessmentAccess: vi.fn(),
  requireCampaignAccess: vi.fn(),
}));

const audit = vi.hoisted(() => ({
  logAuditEvent: vi.fn(),
}));

const cache = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

const queryBuilder = vi.hoisted(() => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chainMethods = ["select", "update", "eq", "single", "order", "in"];
  for (const method of chainMethods) {
    builder[method] = vi.fn();
    builder[method].mockReturnValue(builder);
  }
  return builder;
});

const supabase = vi.hoisted(() => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => queryBuilder),
  })),
}));

vi.mock("@/lib/auth/authorization", () => ({
  canManageCampaign: auth.canManageCampaign,
  requireAssessmentAccess: auth.requireAssessmentAccess,
  requireCampaignAccess: auth.requireCampaignAccess,
}));

vi.mock("@/lib/auth/support-sessions", () => ({
  logAuditEvent: audit.logAuditEvent,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: supabase.createAdminClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath: cache.revalidatePath,
}));

import {
  updateAssessmentIntro,
  updateCampaignIntroOverride,
} from "@/app/actions/assessment-intro";

function resetBuilder() {
  for (const method of Object.keys(queryBuilder)) {
    queryBuilder[method].mockReset();
    queryBuilder[method].mockReturnValue(queryBuilder);
  }
}

describe("assessment intro actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilder();
  });

  it("updates assessment intro content for scoped partner-managed assessments", async () => {
    auth.requireAssessmentAccess.mockResolvedValueOnce({
      scope: {
        actor: { id: "partner-admin-1" },
      },
      assessmentId: "11111111-1111-4111-8111-111111111111",
      partnerId: "partner-a",
      clientId: null,
    });
    queryBuilder.eq.mockResolvedValueOnce({ error: null });

    const assessmentId = "11111111-1111-4111-8111-111111111111";

    const result = await updateAssessmentIntro(assessmentId, {
      enabled: true,
      heading: "Welcome",
      body: "<p>Hello</p>",
      buttonLabel: "Start",
    });

    expect(result).toEqual({ success: true });
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorProfileId: "partner-admin-1",
        eventType: "assessment.intro_content.updated",
        targetId: assessmentId,
      }),
    );
    expect(cache.revalidatePath).toHaveBeenCalledWith("/assessments");
    expect(cache.revalidatePath).toHaveBeenCalledWith(`/assessments/${assessmentId}/edit`);
    expect(cache.revalidatePath).toHaveBeenCalledWith(
      `/assessments/${assessmentId}/edit/intro`,
    );
    expect(cache.revalidatePath).toHaveBeenCalledWith("/partner/assessments");
    expect(cache.revalidatePath).toHaveBeenCalledWith(
      `/partner/assessments/${assessmentId}/edit`,
    );
    expect(cache.revalidatePath).toHaveBeenCalledWith(
      `/partner/assessments/${assessmentId}/edit/intro`,
    );
  });

  it("rejects campaign intro overrides when the caller cannot manage the campaign", async () => {
    auth.requireCampaignAccess.mockResolvedValueOnce({
      scope: {
        isPlatformAdmin: false,
        partnerAdminIds: [],
        clientAdminIds: [],
      },
      campaignId: "campaign-1",
      partnerId: "partner-a",
      clientId: "client-a",
    });
    auth.canManageCampaign.mockReturnValueOnce(false);

    const result = await updateCampaignIntroOverride(
      "campaign-1",
      "assessment-1",
      {
        heading: "Custom heading",
        body: "<p>Custom body</p>",
        buttonLabel: "Continue",
      },
    );

    expect(result).toEqual({
      error: "You do not have permission to update this campaign.",
    });
    expect(queryBuilder.update).not.toHaveBeenCalled();
  });
});
