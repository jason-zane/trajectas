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

// requireClientAccess is mocked per test; canManageClient is the real pure
// function so the managed-set rule is exercised, not re-implemented.
vi.mock("@/lib/auth/authorization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/authorization")>();
  return {
    ...actual,
    requireClientAccess: auth.requireClientAccess,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: supabase.createAdminClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: supabase.createClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath: cache.revalidatePath,
}));

vi.mock("@/lib/auth/support-sessions", () => ({
  logAuditEventSafe: vi.fn(),
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

const CLIENT_ID = "11111111-1111-1111-1111-111111111111";

function adminScope() {
  return {
    scope: {
      isPlatformAdmin: true,
      managedClientIds: [] as string[],
      actor: { id: "admin-user-1" },
    },
    clientId: CLIENT_ID,
    partnerId: null,
  };
}

/** Signed in, sees the client, manages nothing (e.g. a partner member). */
function nonAdminScope() {
  return {
    scope: {
      isPlatformAdmin: false,
      managedClientIds: [] as string[],
      actor: { id: "member-user-1" },
    },
    clientId: CLIENT_ID,
    partnerId: null,
  };
}

/** A partner admin whose managed set includes the client (resolved by the scope). */
function partnerAdminScope() {
  return {
    scope: {
      isPlatformAdmin: false,
      managedClientIds: [CLIENT_ID],
      actor: { id: "partner-admin-1" },
    },
    clientId: CLIENT_ID,
    partnerId: "99999999-9999-9999-9999-999999999999",
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
            id: "33333333-3333-3333-3333-333333333333",
            client_id: "11111111-1111-1111-1111-111111111111",
            assessment_id: "22222222-2222-2222-2222-222222222222",
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
        data: [{ assessment_id: "22222222-2222-2222-2222-222222222222", quota_used: 42 }],
        error: null,
      });

      const result = await getAssessmentAssignments("11111111-1111-1111-1111-111111111111");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "33333333-3333-3333-3333-333333333333",
        assessmentId: "22222222-2222-2222-2222-222222222222",
        assessmentName: "Leadership 360",
        quotaLimit: 100,
        quotaUsed: 42,
      });
      expect(queryBuilder.rpc).toHaveBeenCalledWith(
        "get_client_assessment_quota_usage_bulk",
        {
          p_client_id: "11111111-1111-1111-1111-111111111111",
        }
      );
    });

    it("returns empty array when no assignments exist", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());
      queryBuilder.order.mockResolvedValueOnce({ data: [], error: null });
      queryBuilder.rpc.mockResolvedValueOnce({ data: [], error: null });

      const result = await getAssessmentAssignments("11111111-1111-1111-1111-111111111111");
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // assignAssessment
  // -------------------------------------------------------------------------
  describe("assignAssessment", () => {
    it("rejects non-admin callers", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(nonAdminScope());

      const result = await assignAssessment("11111111-1111-1111-1111-111111111111", {
        assessmentId: "22222222-2222-2222-2222-222222222222",
      });

      expect(result).toEqual({
        error: "You do not have permission to manage this client.",
      });
    });

    it("creates an assignment for admin callers", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());
      // Partner check: client has no partner
      queryBuilder.single
        .mockResolvedValueOnce({ data: { partner_id: null }, error: null })
        // INSERT result
        .mockResolvedValueOnce({ data: { id: "44444444-4444-4444-4444-444444444444" }, error: null });

      const result = await assignAssessment("11111111-1111-1111-1111-111111111111", {
        assessmentId: "22222222-2222-2222-2222-222222222222",
        quotaLimit: 50,
      });

      expect(result).toEqual({ success: true, id: "44444444-4444-4444-4444-444444444444" });
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

      const result = await assignAssessment("11111111-1111-1111-1111-111111111111", {
        assessmentId: "22222222-2222-2222-2222-222222222222",
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
            id: "33333333-3333-3333-3333-333333333333",
            assessment_id: "22222222-2222-2222-2222-222222222222",
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

      const result = await checkQuotaAvailability("11111111-1111-1111-1111-111111111111", ["22222222-2222-2222-2222-222222222222"]);
      expect(result).toEqual({ allowed: true, violations: [] });
    });

    it("returns violations when quota is exhausted", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());

      queryBuilder.in.mockResolvedValueOnce({
        data: [
          {
            id: "33333333-3333-3333-3333-333333333333",
            assessment_id: "22222222-2222-2222-2222-222222222222",
            quota_limit: 10,
            is_active: true,
          },
        ],
        error: null,
      });

      // bulk rpc for usage
      queryBuilder.rpc.mockResolvedValueOnce({
        data: [{ assessment_id: "22222222-2222-2222-2222-222222222222", quota_used: 10 }],
        error: null,
      });
      queryBuilder.single.mockResolvedValueOnce({
        data: { partner_id: null },
        error: null,
      });

      const result = await checkQuotaAvailability("11111111-1111-1111-1111-111111111111", ["22222222-2222-2222-2222-222222222222"]);

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toEqual({
        assessmentId: "22222222-2222-2222-2222-222222222222",
        quotaLimit: 10,
        quotaUsed: 10,
      });
      expect(queryBuilder.rpc).toHaveBeenCalledWith(
        "get_client_assessment_quota_usage_bulk",
        {
          p_client_id: "11111111-1111-1111-1111-111111111111",
        }
      );
    });

    it("allows when usage is below quota limit", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());

      queryBuilder.in.mockResolvedValueOnce({
        data: [
          {
            id: "33333333-3333-3333-3333-333333333333",
            assessment_id: "22222222-2222-2222-2222-222222222222",
            quota_limit: 10,
            is_active: true,
          },
        ],
        error: null,
      });

      queryBuilder.rpc.mockResolvedValueOnce({
        data: [{ assessment_id: "22222222-2222-2222-2222-222222222222", quota_used: 5 }],
        error: null,
      });
      queryBuilder.single.mockResolvedValueOnce({
        data: { partner_id: null },
        error: null,
      });

      const result = await checkQuotaAvailability("11111111-1111-1111-1111-111111111111", ["22222222-2222-2222-2222-222222222222"]);
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

      const result = await updateAssessmentAssignment("33333333-3333-3333-3333-333333333333", "11111111-1111-1111-1111-111111111111", {
        quotaLimit: 200,
      });

      expect(result).toEqual({
        error: "You do not have permission to manage this client.",
      });
    });

    it("updates the assignment for admin callers", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());
      // Setup for the first chain (fetch previous state)
      queryBuilder.select.mockReturnValueOnce(queryBuilder);
      queryBuilder.eq
        .mockReturnValueOnce(queryBuilder)  // first eq
        .mockReturnValueOnce(queryBuilder)  // second eq
        .mockReturnValueOnce(queryBuilder)  // third eq (update query)
      // .single() must resolve with the fetched data
      queryBuilder.single.mockResolvedValueOnce({
        data: { assessment_id: "aaa", quota_limit: 100, is_active: true },
        error: null,
      });
      // The final update resolves to error: null
      queryBuilder.update.mockReturnValueOnce(queryBuilder);

      const result = await updateAssessmentAssignment("33333333-3333-3333-3333-333333333333", "11111111-1111-1111-1111-111111111111", {
        quotaLimit: 200,
      });

      expect(result).toEqual({ success: true, id: "33333333-3333-3333-3333-333333333333" });
      expect(cache.revalidatePath).toHaveBeenCalledWith("/clients");
    });
  });

  // -------------------------------------------------------------------------
  // removeAssessmentAssignment
  // -------------------------------------------------------------------------
  describe("removeAssessmentAssignment", () => {
    it("soft-deactivates via updateAssessmentAssignment", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());
      // Setup for the first chain (fetch previous state)
      queryBuilder.select.mockReturnValueOnce(queryBuilder);
      queryBuilder.eq
        .mockReturnValueOnce(queryBuilder)  // first eq
        .mockReturnValueOnce(queryBuilder)  // second eq
        .mockReturnValueOnce(queryBuilder)  // third eq (update query)
      // .single() must resolve with the fetched data
      queryBuilder.single.mockResolvedValueOnce({
        data: { assessment_id: "aaa", quota_limit: 100, is_active: true },
        error: null,
      });
      // The final update resolves to error: null
      queryBuilder.update.mockReturnValueOnce(queryBuilder);

      const result = await removeAssessmentAssignment("33333333-3333-3333-3333-333333333333", "11111111-1111-1111-1111-111111111111");
      expect(result).toEqual({ success: true, id: "33333333-3333-3333-3333-333333333333" });
    });
  });

  // -------------------------------------------------------------------------
  // toggleClientBranding
  // -------------------------------------------------------------------------
  describe("toggleClientBranding", () => {
    it("rejects non-admin callers", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(nonAdminScope());

      const result = await toggleClientBranding("11111111-1111-1111-1111-111111111111", true);
      expect(result).toEqual({
        error: "You do not have permission to manage this client.",
      });
    });

    it("updates branding flag for admin callers", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(adminScope());
      // Setup for the first chain (fetch previous state)
      queryBuilder.select.mockReturnValueOnce(queryBuilder);
      queryBuilder.eq
        .mockReturnValueOnce(queryBuilder)  // eq in fetch chain
        .mockReturnValueOnce(queryBuilder)  // eq in update chain
      // .single() must resolve with the fetched data
      queryBuilder.single.mockResolvedValueOnce({
        data: { can_customize_branding: false },
        error: null,
      });
      // The final update resolves to error: null
      queryBuilder.update.mockReturnValueOnce(queryBuilder);

      const result = await toggleClientBranding("11111111-1111-1111-1111-111111111111", true);
      expect(result).toEqual({ success: true, id: "11111111-1111-1111-1111-111111111111" });
      expect(cache.revalidatePath).toHaveBeenCalledWith("/clients", "layout");
      expect(cache.revalidatePath).toHaveBeenCalledWith("/client", "layout");
      expect(cache.revalidatePath).toHaveBeenCalledWith("/partner/clients", "layout");
    });
  });

  // -------------------------------------------------------------------------
  // Partner admins (Phase 1 of the partner self-service plan)
  // -------------------------------------------------------------------------
  describe("partner admin callers", () => {
    const ASSESSMENT_ID = "22222222-2222-2222-2222-222222222222";
    const PARTNER_ID = "99999999-9999-9999-9999-999999999999";

    it("assignAssessment refuses an assessment outside the partner's allocation", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(partnerAdminScope());
      // clients → partner-owned client
      queryBuilder.single.mockResolvedValueOnce({ data: { partner_id: PARTNER_ID }, error: null });
      // partner_assessment_assignments → no pool row; assessments → owned by nobody
      queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      queryBuilder.single.mockResolvedValueOnce({ data: { partner_id: null, client_id: null }, error: null });

      const result = await assignAssessment(CLIENT_ID, { assessmentId: ASSESSMENT_ID, quotaLimit: 5 });
      expect(result).toEqual({
        error: "This assessment is not available through the partner's allocation.",
      });
      expect(queryBuilder.insert).not.toHaveBeenCalled();
    });

    it("assignAssessment caps the client quota at the partner allocation", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(partnerAdminScope());
      queryBuilder.single.mockResolvedValueOnce({ data: { partner_id: PARTNER_ID }, error: null });
      queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { quota_limit: 5 }, error: null });
      queryBuilder.single.mockResolvedValueOnce({ data: { partner_id: null, client_id: null }, error: null });

      const result = await assignAssessment(CLIENT_ID, { assessmentId: ASSESSMENT_ID, quotaLimit: 10 });
      expect(result).toEqual({ error: "Quota cannot exceed the partner allocation of 5." });
    });

    it("assignAssessment requires a quota when the partner allocation is capped", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(partnerAdminScope());
      queryBuilder.single.mockResolvedValueOnce({ data: { partner_id: PARTNER_ID }, error: null });
      queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { quota_limit: 5 }, error: null });
      queryBuilder.single.mockResolvedValueOnce({ data: { partner_id: null, client_id: null }, error: null });

      const result = await assignAssessment(CLIENT_ID, { assessmentId: ASSESSMENT_ID, quotaLimit: null });
      expect(result).toEqual({
        error: "Set a quota of at most 5: this assessment is capped for your partner.",
      });
    });

    it("assignAssessment accepts a partner-owned assessment with no pool row (D4)", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(partnerAdminScope());
      queryBuilder.single.mockResolvedValueOnce({ data: { partner_id: PARTNER_ID }, error: null });
      queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      queryBuilder.single.mockResolvedValueOnce({ data: { partner_id: PARTNER_ID, client_id: null }, error: null });
      // insert → select → single resolves with the new row
      queryBuilder.single.mockResolvedValueOnce({ data: { id: "new-assignment" }, error: null });

      const result = await assignAssessment(CLIENT_ID, { assessmentId: ASSESSMENT_ID, quotaLimit: 25 });
      expect(result).toEqual({ success: true, id: "new-assignment" });
      expect(cache.revalidatePath).toHaveBeenCalledWith("/partner/clients", "layout");
    });

    it("toggleClientBranding refuses to enable while the partner's own flag is off (D5)", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(partnerAdminScope());
      // clients (previous state) → partner-owned; partners → flag off
      queryBuilder.single.mockResolvedValueOnce({
        data: { can_customize_branding: false, partner_id: PARTNER_ID },
        error: null,
      });
      queryBuilder.single.mockResolvedValueOnce({ data: { can_customize_branding: false }, error: null });

      const result = await toggleClientBranding(CLIENT_ID, true);
      expect(result).toEqual({
        error: "Brand customisation is not enabled for your partner. Contact Trajectas to enable it.",
      });
      expect(queryBuilder.update).not.toHaveBeenCalled();
    });

    it("toggleClientBranding enables branding once the partner's flag is on", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(partnerAdminScope());
      queryBuilder.single.mockResolvedValueOnce({
        data: { can_customize_branding: false, partner_id: PARTNER_ID },
        error: null,
      });
      queryBuilder.single.mockResolvedValueOnce({ data: { can_customize_branding: true }, error: null });
      queryBuilder.update.mockReturnValueOnce(queryBuilder);

      const result = await toggleClientBranding(CLIENT_ID, true);
      expect(result).toEqual({ success: true, id: CLIENT_ID });
    });

    it("a signed-in caller who manages nothing is still refused", async () => {
      auth.requireClientAccess.mockResolvedValueOnce(nonAdminScope());
      const result = await toggleClientBranding(CLIENT_ID, false);
      expect(result).toEqual({ error: "You do not have permission to manage this client." });
    });
  });
});
