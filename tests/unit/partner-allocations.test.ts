import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A partner sees platform-owned assessments and report templates only where the
 * platform has ALLOCATED them.
 *
 * The listings used to treat "both owner columns null" as a shared library, so
 * a brand-new partner with nothing allocated saw the entire platform
 * catalogue — every assessment including drafts, and every report template.
 * That is another business looking at product they have not been given.
 *
 * These tests pin the three behaviours that matter: an unconfined caller is not
 * narrowed, a confined one is narrowed to its allocation, and a failed lookup
 * fails CLOSED rather than falling back to showing everything.
 */

const selectMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => selectMock() }),
}));

import { getAllocatedAssessmentIds, getAllocatedReportTemplateIds } from "@/lib/auth/partner-allocations";
import type { AuthorizedScope } from "@/lib/auth/authorization";

function scope(overrides: Partial<AuthorizedScope> = {}): AuthorizedScope {
  return {
    actor: null,
    activeContext: null,
    previewContext: null,
    requestSurface: "partner",
    isPlatformAdmin: false,
    isLocalDevelopmentBypass: false,
    partnerIds: [],
    partnerAdminIds: [],
    clientIds: [],
    clientAdminIds: [],
    managedClientIds: [],
    isLocalDevelopment: false,
    supportSession: null,
    ...overrides,
  } as AuthorizedScope;
}

/** Chainable stub ending in the awaited { data, error }. */
function rows(result: { data?: unknown[]; error?: unknown }) {
  const chain = {
    select: () => chain,
    in: () => chain,
    eq: () => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }),
  };
  return chain;
}

beforeEach(() => {
  selectMock.mockReset();
});

describe("partner allocations", () => {
  it("does not narrow a platform admin — null means unrestricted", async () => {
    const result = await getAllocatedAssessmentIds(scope({ isPlatformAdmin: true }));
    expect(result).toBeNull();
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("does not narrow a caller with no partner at all", async () => {
    // A client admin is not confined to a partner, so partner allocation has
    // nothing to say about them.
    const result = await getAllocatedAssessmentIds(scope({ clientIds: ["c1"] }));
    expect(result).toBeNull();
  });

  it("returns only the assessments allocated to the partner", async () => {
    selectMock.mockReturnValue(
      rows({ data: [{ assessment_id: "a1" }, { assessment_id: "a2" }] })
    );
    const result = await getAllocatedAssessmentIds(scope({ partnerIds: ["p1"] }));
    expect(result).toEqual(["a1", "a2"]);
  });

  it("returns an empty allocation as empty, not as unrestricted", async () => {
    // The regression that started this: a partner with nothing allocated must
    // see nothing, and [] is meaningfully different from null here.
    selectMock.mockReturnValue(rows({ data: [] }));
    const result = await getAllocatedAssessmentIds(scope({ partnerIds: ["p1"] }));
    expect(result).toEqual([]);
    expect(result).not.toBeNull();
  });

  it("de-duplicates when two partners share an allocation", async () => {
    selectMock.mockReturnValue(
      rows({ data: [{ assessment_id: "a1" }, { assessment_id: "a1" }] })
    );
    const result = await getAllocatedAssessmentIds(scope({ partnerIds: ["p1", "p2"] }));
    expect(result).toEqual(["a1"]);
  });

  it("fails closed when the allocation lookup errors", async () => {
    selectMock.mockReturnValue(rows({ error: { message: "boom" } }));
    const result = await getAllocatedAssessmentIds(scope({ partnerIds: ["p1"] }));
    expect(result).toEqual([]);
  });

  it("applies the same rule to report templates", async () => {
    selectMock.mockReturnValue(rows({ data: [{ report_template_id: "t1" }] }));
    const result = await getAllocatedReportTemplateIds(scope({ partnerIds: ["p1"] }));
    expect(result).toEqual(["t1"]);
  });
});
