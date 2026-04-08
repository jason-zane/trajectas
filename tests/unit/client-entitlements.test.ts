import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const auth = vi.hoisted(() => ({
  requireClientAccess: vi.fn(),
}));

const cache = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

// Chain-able Supabase query builder mock
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
    "rpc",
  ];
  for (const m of chainMethods) {
    builder[m] = vi.fn();
  }
  // Default: each chain method returns the builder itself
  for (const m of chainMethods) {
    builder[m].mockReturnValue(builder);
  }
  return builder;
});

const supabase = vi.hoisted(() => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => queryBuilder),
    rpc: queryBuilder.rpc,
  })),
  createClient: vi.fn(async () => ({
    from: vi.fn(() => queryBuilder),
    rpc: queryBuilder.rpc,
  })),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/authorization", () => ({
  requireClientAccess: auth.requireClientAccess,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: supabase.createAdminClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: supabase.createClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath: cache.revalidatePath,
}));

// ---------------------------------------------------------------------------
// Import actions under test (AFTER mocks)
// ---------------------------------------------------------------------------

import {
  getAssessmentAssignments,
  assignAssessment,
  checkQuotaAvailability,
  updateAssessmentAssignment,
  removeAssessmentAssignment,
  toggleClientBranding,
} from "@/app/actions/client-entitlements";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function adminScope() {
  return {
    scope: {
      isPlatformAdmin: true,
      actor: { id: "admin-user-1" },
    },
    clientId: "org-1",
    partnerId: null,
  };
}

function nonAdminScope() {
  return {
    scope: {
      isPlatformAdmin: false,
      actor: { id: "member-user-1" },
    },
    clientId: "org-1",
    partnerId: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("client entitlement actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain methods to return the builder by default
    for (const m of Object.keys(queryBuilder)) {
      queryBuilder[m].mockReturnValue(queryBuilder);
    }
  });

  // -------------------------------------------------------------------------
  // getAssessmentAssignments
  // -------------------------------------------------------------------------
  describe("getAssessmentAssignments", () => {
    it("returns assignments with usage data", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());

      // select().eq().eq().order() -> { data, error }
      queryBuilder.order.mockResolvedValueOnce({
        data: [
          {
            id: "assign-1",
            client_id: "org-1",
            assessment_id: "assess-1",
            quota_limit: 100,
            is_active: true,
            assigned_by: "admin-user-1",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            assessments: { title: "Leadership 360" },
          },
        ],
        error: null,
      });

      // bulk rpc for quota usage
      queryBuilder.rpc.mockResolvedValueOnce({
        data: [{ assessment_id: "assess-1", quota_used: 42 }],
        error: null,
      });

      const result = await getAssessmentAssignments("org-1");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "assign-1",
        assessmentId: "assess-1",
        assessmentName: "Leadership 360",
        quotaLimit: 100,
        quotaUsed: 42,
      });
      expect(queryBuilder.rpc).toHaveBeenCalledWith(
        "get_client_assessment_quota_usage_bulk",
        {
          p_client_id: "org-1",
        }
      );
    });

    it("returns empty array when no assignments exist", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());
      queryBuilder.order.mockResolvedValueOnce({ data: [], error: null });
      queryBuilder.rpc.mockResolvedValueOnce({ data: [], error: null });

      const result = await getAssessmentAssignments("org-1");
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // assignAssessment
  // -------------------------------------------------------------------------
  describe("assignAssessment", () => {
    it("rejects non-admin callers", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(nonAdminScope());

      const result = await assignAssessment("org-1", {
        assessmentId: "assess-1",
      });

      expect(result).toEqual({
        error: "Only platform administrators can assign assessments.",
      });
    });

    it("creates an assignment for admin callers", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());
      // Partner check: client has no partner
      queryBuilder.single
        .mockResolvedValueOnce({ data: { partner_id: null }, error: null })
        // INSERT result
        .mockResolvedValueOnce({ data: { id: "new-assign-1" }, error: null });

      const result = await assignAssessment("org-1", {
        assessmentId: "assess-1",
        quotaLimit: 50,
      });

      expect(result).toEqual({ success: true, id: "new-assign-1" });
      expect(cache.revalidatePath).toHaveBeenCalledWith("/clients");
    });

    it("returns a friendly error on duplicate assignment", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());
      // Partner check: client has no partner
      queryBuilder.single
        .mockResolvedValueOnce({ data: { partner_id: null }, error: null })
        // INSERT result: duplicate
        .mockResolvedValueOnce({
          data: null,
          error: { code: "23505", message: "unique violation" },
        });

      const result = await assignAssessment("org-1", {
        assessmentId: "assess-1",
      });

      expect(result).toEqual({
        error: "This assessment is already assigned to this client.",
      });
    });
  });

  // -------------------------------------------------------------------------
  // checkQuotaAvailability
  // -------------------------------------------------------------------------
  describe("checkQuotaAvailability", () => {
    it("returns allowed when all assessments have unlimited quota", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());

      // select + eq + eq + in chain -> resolves
      queryBuilder.in.mockResolvedValueOnce({
        data: [
          {
            id: "assign-1",
            assessment_id: "assess-1",
            quota_limit: null,
            is_active: true,
          },
        ],
        error: null,
      });
      queryBuilder.rpc.mockResolvedValueOnce({ data: [], error: null });
      queryBuilder.single.mockResolvedValueOnce({
        data: { partner_id: null },
        error: null,
      });

      const result = await checkQuotaAvailability("org-1", ["assess-1"]);
      expect(result).toEqual({ allowed: true, violations: [] });
    });

    it("returns violations when quota is exhausted", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());

      queryBuilder.in.mockResolvedValueOnce({
        data: [
          {
            id: "assign-1",
            assessment_id: "assess-1",
            quota_limit: 10,
            is_active: true,
          },
        ],
        error: null,
      });

      // bulk rpc for usage
      queryBuilder.rpc.mockResolvedValueOnce({
        data: [{ assessment_id: "assess-1", quota_used: 10 }],
        error: null,
      });
      queryBuilder.single.mockResolvedValueOnce({
        data: { partner_id: null },
        error: null,
      });

      const result = await checkQuotaAvailability("org-1", ["assess-1"]);

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toEqual({
        assessmentId: "assess-1",
        quotaLimit: 10,
        quotaUsed: 10,
      });
      expect(queryBuilder.rpc).toHaveBeenCalledWith(
        "get_client_assessment_quota_usage_bulk",
        {
          p_client_id: "org-1",
        }
      );
    });

    it("allows when usage is below quota limit", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());

      queryBuilder.in.mockResolvedValueOnce({
        data: [
          {
            id: "assign-1",
            assessment_id: "assess-1",
            quota_limit: 10,
            is_active: true,
          },
        ],
        error: null,
      });

      queryBuilder.rpc.mockResolvedValueOnce({
        data: [{ assessment_id: "assess-1", quota_used: 5 }],
        error: null,
      });
      queryBuilder.single.mockResolvedValueOnce({
        data: { partner_id: null },
        error: null,
      });

      const result = await checkQuotaAvailability("org-1", ["assess-1"]);
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // updateAssessmentAssignment
  // -------------------------------------------------------------------------
  describe("updateAssessmentAssignment", () => {
    it("rejects non-admin callers", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(nonAdminScope());

      const result = await updateAssessmentAssignment("assign-1", "org-1", {
        quotaLimit: 200,
      });

      expect(result).toEqual({
        error:
          "Only platform administrators can update assessment assignments.",
      });
    });

    it("updates the assignment for admin callers", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());
      // .eq('id', ...) returns builder, .eq('client_id', ...) resolves
      queryBuilder.eq
        .mockReturnValueOnce(queryBuilder)
        .mockResolvedValueOnce({ error: null });

      const result = await updateAssessmentAssignment("assign-1", "org-1", {
        quotaLimit: 200,
      });

      expect(result).toEqual({ success: true, id: "assign-1" });
      expect(cache.revalidatePath).toHaveBeenCalledWith("/clients");
    });
  });

  // -------------------------------------------------------------------------
  // removeAssessmentAssignment
  // -------------------------------------------------------------------------
  describe("removeAssessmentAssignment", () => {
    it("soft-deactivates via updateAssessmentAssignment", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());
      // .eq('id', ...) returns builder, .eq('client_id', ...) resolves
      queryBuilder.eq
        .mockReturnValueOnce(queryBuilder)
        .mockResolvedValueOnce({ error: null });

      const result = await removeAssessmentAssignment("assign-1", "org-1");
      expect(result).toEqual({ success: true, id: "assign-1" });
    });
  });

  // -------------------------------------------------------------------------
  // toggleClientBranding
  // -------------------------------------------------------------------------
  describe("toggleClientBranding", () => {
    it("rejects non-admin callers", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(nonAdminScope());

      const result = await toggleClientBranding("org-1", true);
      expect(result).toEqual({
        error: "Only platform administrators can manage branding settings.",
      });
    });

    it("updates branding flag for admin callers", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());
      queryBuilder.eq.mockResolvedValueOnce({ error: null });

      const result = await toggleClientBranding("org-1", true);
      expect(result).toEqual({ success: true, id: "org-1" });
      expect(cache.revalidatePath).toHaveBeenCalledWith("/clients");
    });
  });
});
