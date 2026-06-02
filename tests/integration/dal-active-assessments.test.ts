import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { listActiveAssessments } from "@/lib/dal/campaigns";

const ts = Date.now();
const slug = (s: string) => `dalaa-${s}-${ts}`.toLowerCase();

/**
 * Validates the listActiveAssessments query against the live local schema: the
 * nested assessment_factors / assessment_sections(response_formats,
 * assessment_section_items) embedded selects resolve, the active+draft status
 * filter, and the partner_id-or-null scope OR. The row → DTO mapping (counts,
 * format label, duration) is unit-tested in dal-campaigns-mappers.test.ts.
 */
describe.skipIf(!canRun)("dal/campaigns: listActiveAssessments", () => {
  const admin = createAdminClient();
  const ids = { active: "", draft: "", archived: "" };

  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ins = async (row: Record<string, any>): Promise<string> => {
      const { data, error } = await admin
        .from("assessments")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(`assessment insert: ${error.message}`);
      return data!.id;
    };
    ids.active = await ins({
      title: `DAL AA Active ${ts}`,
      slug: slug("active"),
      status: "active",
    });
    ids.draft = await ins({
      title: `DAL AA Draft ${ts}`,
      slug: slug("draft"),
      status: "draft",
    });
    ids.archived = await ins({
      title: `DAL AA Archived ${ts}`,
      slug: slug("archived"),
      status: "archived",
    });
  });

  afterAll(async () => {
    await admin
      .from("assessments")
      .delete()
      .in("id", [ids.active, ids.draft, ids.archived].filter(Boolean));
  });

  it("returns active + draft (not archived) with zero counts for empty assessments", async () => {
    const rows = await listActiveAssessments(admin, { partnerIds: null });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId[ids.active]).toBeDefined();
    expect(byId[ids.draft]).toBeDefined();
    expect(byId[ids.archived]).toBeUndefined();
    expect(byId[ids.active]).toMatchObject({
      sectionCount: 0,
      totalItemCount: 0,
      factorCount: 0,
      formatLabel: "Traditional",
      estimatedDurationMinutes: 0,
    });
  });

  it("includes platform-owned (partner_id null) assessments under a partner scope", async () => {
    const rows = await listActiveAssessments(admin, {
      partnerIds: ["00000000-0000-0000-0000-000000000000"],
    });
    // The seeded assessments have partner_id null, so the `partner_id.is.null`
    // arm of the OR keeps them visible even under a non-matching partner scope.
    expect(rows.map((r) => r.id)).toContain(ids.active);
  });
});
