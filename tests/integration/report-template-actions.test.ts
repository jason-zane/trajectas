import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => {
  class MockAuthorizationError extends Error {
    constructor(message = "You do not have permission to perform this action.") {
      super(message);
      this.name = "AuthorizationError";
    }
  }

  return {
    AuthorizationError: MockAuthorizationError,
    canManageCampaign: vi.fn(),
    canManageReportTemplateLibrary: vi.fn(),
    getAccessibleCampaignIds: vi.fn(),
    getAccessiblePartnerIds: vi.fn(),
    getPreferredPartnerIdForReportTemplateCreation: vi.fn(),
    requireAdminScope: vi.fn(),
    requireCampaignAccess: vi.fn(),
    requireParticipantAccess: vi.fn(),
    requireReportSnapshotAccess: vi.fn(),
    requireReportTemplateAccess: vi.fn(),
    resolveAuthorizedScope: vi.fn(),
  };
});

const cache = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

const queryBuilder = vi.hoisted(() => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chainMethods = [
    "select",
    "insert",
    "update",
    "upsert",
    "eq",
    "in",
    "is",
    "order",
    "single",
    "maybeSingle",
    "or",
  ];
  for (const method of chainMethods) {
    builder[method] = vi.fn();
    builder[method].mockReturnValue(builder);
  }
  return builder;
});

const supabase = vi.hoisted(() => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => queryBuilder),
    storage: { from: vi.fn() },
  })),
  createClient: vi.fn(async () => ({
    from: vi.fn(() => queryBuilder),
  })),
}));

vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: auth.AuthorizationError,
  canManageCampaign: auth.canManageCampaign,
  canManageReportTemplateLibrary: auth.canManageReportTemplateLibrary,
  getAccessibleCampaignIds: auth.getAccessibleCampaignIds,
  getAccessiblePartnerIds: auth.getAccessiblePartnerIds,
  getPreferredPartnerIdForReportTemplateCreation:
    auth.getPreferredPartnerIdForReportTemplateCreation,
  requireAdminScope: auth.requireAdminScope,
  requireCampaignAccess: auth.requireCampaignAccess,
  requireParticipantAccess: auth.requireParticipantAccess,
  requireReportSnapshotAccess: auth.requireReportSnapshotAccess,
  requireReportTemplateAccess: auth.requireReportTemplateAccess,
  resolveAuthorizedScope: auth.resolveAuthorizedScope,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: supabase.createAdminClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: supabase.createClient,
}));

vi.mock("@/lib/auth/support-sessions", () => ({
  logReportViewed: vi.fn(),
  logSupportSessionDataAccess: vi.fn(),
}));

vi.mock("@/lib/integrations/events", () => ({
  enqueueReportSnapshotEvent: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: cache.revalidatePath,
}));

import {
  cloneReportTemplate,
  createReportTemplate,
  getReportTemplates,
  linkTemplateToCampaign,
} from "@/app/actions/reports";

function resetBuilder() {
  for (const method of Object.keys(queryBuilder)) {
    queryBuilder[method].mockReset();
    queryBuilder[method].mockReturnValue(queryBuilder);
  }
}

function reportTemplateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "template-1",
    partner_id: null,
    name: "Template",
    description: null,
    report_type: "self_report",
    display_level: "factor",
    group_by_dimension: false,
    person_reference: "the_participant",
    auto_release: false,
    page_header_logo: "none",
    blocks: [],
    is_active: true,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("report template actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilder();
  });

  it("creates partner-owned templates using the active partner scope", async () => {
    auth.resolveAuthorizedScope.mockResolvedValueOnce({
      isPlatformAdmin: false,
      partnerAdminIds: ["partner-a"],
      activeContext: { tenantType: "partner", tenantId: "partner-a" },
    });
    auth.canManageReportTemplateLibrary.mockReturnValueOnce(true);
    auth.getPreferredPartnerIdForReportTemplateCreation.mockReturnValueOnce("partner-a");
    queryBuilder.single.mockResolvedValueOnce({
      data: reportTemplateRow({ id: "template-a", partner_id: "partner-a" }),
      error: null,
    });

    const result = await createReportTemplate({
      name: "Partner Template",
      reportType: "self_report",
      displayLevel: "factor",
    });

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Partner Template",
        partner_id: "partner-a",
      }),
    );
    expect(result.partnerId).toBe("partner-a");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/report-templates");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/partner/report-templates");
  });

  it("rejects non-admin callers from creating report templates", async () => {
    auth.resolveAuthorizedScope.mockResolvedValueOnce({
      isPlatformAdmin: false,
      partnerAdminIds: [],
      activeContext: { tenantType: "partner", tenantId: "partner-a" },
    });
    auth.canManageReportTemplateLibrary.mockReturnValueOnce(false);

    await expect(
      createReportTemplate({
        name: "Blocked",
        reportType: "self_report",
        displayLevel: "factor",
      }),
    ).rejects.toThrow(
      "Only platform or partner administrators can manage report templates.",
    );
  });

  it("filters the template list to platform plus accessible partner templates", async () => {
    auth.resolveAuthorizedScope.mockResolvedValueOnce({
      isPlatformAdmin: false,
      partnerAdminIds: ["partner-a"],
      activeContext: { tenantType: "partner", tenantId: "partner-a" },
    });
    auth.getAccessiblePartnerIds.mockResolvedValueOnce(["partner-a"]);
    queryBuilder.order.mockResolvedValueOnce({
      data: [
        reportTemplateRow({ id: "platform-template", partner_id: null }),
        reportTemplateRow({ id: "partner-template", partner_id: "partner-a" }),
        reportTemplateRow({ id: "other-template", partner_id: "partner-b" }),
      ],
      error: null,
    });

    const templates = await getReportTemplates();

    expect(templates.map((template) => template.id)).toEqual([
      "platform-template",
      "partner-template",
    ]);
  });

  it("clones platform templates into the caller's partner scope", async () => {
    const partnerAccess = {
      scope: {
        isPlatformAdmin: false,
        partnerAdminIds: ["partner-a"],
        activeContext: { tenantType: "partner", tenantId: "partner-a" },
      },
      templateId: "platform-template",
      partnerId: null,
    };

    auth.requireReportTemplateAccess
      .mockResolvedValueOnce(partnerAccess)
      .mockResolvedValueOnce(partnerAccess);
    auth.getPreferredPartnerIdForReportTemplateCreation.mockReturnValueOnce("partner-a");
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: reportTemplateRow({
        id: "platform-template",
        name: "Platform Template",
        partner_id: null,
      }),
      error: null,
    });
    queryBuilder.single.mockResolvedValueOnce({
      data: reportTemplateRow({
        id: "partner-clone",
        name: "Platform Template (copy)",
        partner_id: "partner-a",
      }),
      error: null,
    });

    const cloned = await cloneReportTemplate("platform-template");

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Platform Template (copy)",
        partner_id: "partner-a",
      }),
    );
    expect(cloned.partnerId).toBe("partner-a");
  });

  it("rejects campaign linking when the caller cannot manage the target campaign", async () => {
    auth.requireReportTemplateAccess.mockResolvedValueOnce({
      scope: { isPlatformAdmin: false },
      templateId: "template-1",
      partnerId: null,
    });
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

    await expect(
      linkTemplateToCampaign("template-1", "campaign-1", "participant"),
    ).rejects.toThrow("You do not have permission to update this campaign.");
  });
});
