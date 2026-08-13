/**
 * getOrCreateSectionForms — the frozen per-session form snapshot (LR-3 /
 * #333). Backs both getSessionState (src/app/actions/assess.ts) and
 * getSessionCompleteness (src/lib/dal/session-completeness.ts), which is why
 * this test lives at the DAL layer rather than only exercising getSessionState.
 *
 * Requires a running local Supabase instance — see
 * tests/integration/_helpers/rls-fixture.ts and
 * tests/architecture/integration-host-guard.test.ts. Run with
 * `npm run test:integration:local`.
 *
 * The underlying property — "once frozen, later edits to the item bank or
 * the campaign's factor selection cannot change what a session already
 * received" — is also proven empirically at the SQL layer (see the task
 * report / PR description for the exact `psql` transcript against
 * scripts/pg-migrate-check.sh --keep-running). This file proves the same
 * property through the real TypeScript DAL function, including the parts a
 * raw SQL probe can't reach: the selection/ordering algorithm itself, and
 * the in-flight-at-deploy reconciliation logic.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getOrCreateSectionForms } from "@/lib/dal/session-forms";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";

const ts = Date.now();
const testSlug = (label: string) => `form-freeze-${label}-${ts}`;

describe.skipIf(!canRun)("getOrCreateSectionForms — frozen per-session forms", () => {
  const adminDb = createAdminClient();

  const ids = {
    partner: "",
    client: "",
    responseFormat: "",
    assessment: "",
    section: "",
    itemOne: "",
    itemTwo: "",
    itemThree: "",
    campaign: "",
    campaignAssessment: "",
  };

  async function insertRow(table: string, row: Record<string, unknown>): Promise<string> {
    const { data, error } = await adminDb.from(table).insert(row).select("id").single();
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
    return data!.id as string;
  }

  async function makeSession(email: string): Promise<{ participantId: string; sessionId: string }> {
    const participantId = await insertRow("campaign_participants", {
      campaign_id: ids.campaign,
      email,
      first_name: "Freeze",
      last_name: "Test",
      status: "in_progress",
      access_token: `${email}-token`,
    });
    const sessionId = await insertRow("participant_sessions", {
      assessment_id: ids.assessment,
      campaign_id: ids.campaign,
      campaign_participant_id: participantId,
      client_id: ids.client,
      status: "in_progress",
    });
    return { participantId, sessionId };
  }

  async function cleanupSession(s: { participantId: string; sessionId: string }) {
    // participant_section_forms rows cascade-delete with their session.
    await adminDb.from("participant_responses").delete().eq("session_id", s.sessionId);
    await adminDb.from("participant_sessions").delete().eq("id", s.sessionId);
    await adminDb.from("campaign_participants").delete().eq("id", s.participantId);
  }

  beforeAll(async () => {
    if (!canRun) return;

    ids.partner = await insertRow("partners", { name: `Freeze Partner ${ts}`, slug: testSlug("partner") });
    ids.client = await insertRow("clients", {
      name: `Freeze Client ${ts}`,
      slug: testSlug("client"),
      partner_id: ids.partner,
    });
    ids.responseFormat = await insertRow("response_formats", {
      name: `Freeze Likert ${ts}`,
      type: "likert",
      config: { points: 5 },
    });
    ids.assessment = await insertRow("assessments", {
      title: `Freeze Assessment ${ts}`,
      slug: testSlug("assessment"),
      client_id: ids.client,
      partner_id: ids.partner,
      status: "active",
    });
    ids.section = await insertRow("assessment_sections", {
      assessment_id: ids.assessment,
      response_format_id: ids.responseFormat,
      title: "Section 1",
      item_ordering: "fixed", // deterministic order, so entry order is easy to assert on
    });

    ids.itemOne = await insertRow("items", {
      response_format_id: ids.responseFormat,
      stem: "Item ONE (original)",
      purpose: "impression_management",
    });
    ids.itemTwo = await insertRow("items", {
      response_format_id: ids.responseFormat,
      stem: "Item TWO (original)",
      purpose: "impression_management",
    });
    ids.itemThree = await insertRow("items", {
      response_format_id: ids.responseFormat,
      stem: "Item THREE (original)",
      purpose: "impression_management",
    });
    await adminDb.from("assessment_section_items").insert([
      { section_id: ids.section, item_id: ids.itemOne, display_order: 0 },
      { section_id: ids.section, item_id: ids.itemTwo, display_order: 1 },
      { section_id: ids.section, item_id: ids.itemThree, display_order: 2 },
    ]);

    ids.campaign = await insertRow("campaigns", {
      title: `Freeze Campaign ${ts}`,
      slug: testSlug("campaign"),
      client_id: ids.client,
      partner_id: ids.partner,
      status: "active",
    });
    ids.campaignAssessment = await insertRow("campaign_assessments", {
      campaign_id: ids.campaign,
      assessment_id: ids.assessment,
      display_order: 0,
    });
  }, 90_000);

  afterAll(async () => {
    if (!canRun) return;
    await adminDb.from("campaign_assessments").delete().eq("campaign_id", ids.campaign);
    await adminDb.from("campaigns").delete().eq("id", ids.campaign);
    await adminDb.from("assessment_section_items").delete().eq("section_id", ids.section);
    await adminDb.from("assessment_sections").delete().eq("id", ids.section);
    await adminDb.from("items").delete().in("id", [ids.itemOne, ids.itemTwo, ids.itemThree]);
    await adminDb.from("assessments").delete().eq("id", ids.assessment);
    await adminDb.from("response_formats").delete().eq("id", ids.responseFormat);
    await adminDb.from("clients").delete().eq("id", ids.client);
    await adminDb.from("partners").delete().eq("id", ids.partner);
  }, 60_000);

  it("freezes a section's delivered items on first read, in section order", async () => {
    const session = await makeSession(`first-read-${ts}@test.local`);
    try {
      const forms = await getOrCreateSectionForms(adminDb, {
        sessionId: session.sessionId,
        assessmentId: ids.assessment,
        campaignId: ids.campaign,
      });
      if ("error" in forms) throw new Error(forms.error);

      const form = forms.get(ids.section);
      expect(form).toBeDefined();
      expect(form!.entries.map((e) => e.itemId)).toEqual([ids.itemOne, ids.itemTwo, ids.itemThree]);
      expect(form!.entries.map((e) => e.position)).toEqual([1, 2, 3]);
      expect(form!.entries.every((e) => e.countsTowardScore)).toBe(true);
      expect(form!.entries.every((e) => e.purpose === "impression_management")).toBe(true);

      const { data: row } = await adminDb
        .from("participant_section_forms")
        .select("entry_count, assembler_version")
        .eq("session_id", session.sessionId)
        .eq("section_id", ids.section)
        .single();
      expect(row!.entry_count).toBe(3);
      expect(row!.assembler_version).toBe("form-assembler@1");
    } finally {
      await cleanupSession(session);
    }
  });

  it("a second read returns the SAME frozen entries even after the item bank changes underneath it", async () => {
    const session = await makeSession(`stable-read-${ts}@test.local`);
    try {
      const first = await getOrCreateSectionForms(adminDb, {
        sessionId: session.sessionId,
        assessmentId: ids.assessment,
        campaignId: ids.campaign,
      });
      if ("error" in first) throw new Error(first.error);
      const firstEntries = first.get(ids.section)!.entries;

      // Edit an item's stem and remove another item from the section —
      // things that would change a LIVE recomputation.
      await adminDb.from("items").update({ stem: "Item ONE (EDITED)" }).eq("id", ids.itemOne);
      await adminDb
        .from("assessment_section_items")
        .delete()
        .eq("section_id", ids.section)
        .eq("item_id", ids.itemTwo);

      const second = await getOrCreateSectionForms(adminDb, {
        sessionId: session.sessionId,
        assessmentId: ids.assessment,
        campaignId: ids.campaign,
      });
      if ("error" in second) throw new Error(second.error);
      const secondEntries = second.get(ids.section)!.entries;

      expect(secondEntries).toEqual(firstEntries);
      expect(secondEntries.map((e) => e.itemId)).toContain(ids.itemTwo);
    } finally {
      // Restore the section membership / item stem for later tests.
      await adminDb.from("items").update({ stem: "Item ONE (original)" }).eq("id", ids.itemOne);
      await adminDb
        .from("assessment_section_items")
        .upsert(
          { section_id: ids.section, item_id: ids.itemTwo, display_order: 1 },
          { onConflict: "section_id,item_id" },
        );
      await cleanupSession(session);
    }
  });

  it("two concurrent first-reads converge on one frozen row, not two different ones", async () => {
    const session = await makeSession(`concurrent-read-${ts}@test.local`);
    try {
      const [a, b] = await Promise.all([
        getOrCreateSectionForms(adminDb, {
          sessionId: session.sessionId,
          assessmentId: ids.assessment,
          campaignId: ids.campaign,
        }),
        getOrCreateSectionForms(adminDb, {
          sessionId: session.sessionId,
          assessmentId: ids.assessment,
          campaignId: ids.campaign,
        }),
      ]);
      if ("error" in a) throw new Error(a.error);
      if ("error" in b) throw new Error(b.error);

      expect(a.get(ids.section)!.entries).toEqual(b.get(ids.section)!.entries);

      const { count } = await adminDb
        .from("participant_section_forms")
        .select("*", { count: "exact", head: true })
        .eq("session_id", session.sessionId)
        .eq("section_id", ids.section);
      expect(count).toBe(1);
    } finally {
      await cleanupSession(session);
    }
  });

  it("in-flight-at-deploy compatibility: an item already answered before the first freeze is preserved even if it would otherwise be dropped", async () => {
    // Simulate a session that started answering BEFORE participant_section_forms
    // existed (i.e. before this feature shipped): a saved response with no
    // frozen form yet. itemTwo is deliberately the one with a prior answer,
    // then the section is edited to remove itemTwo before the very first
    // freeze happens — mimicking "the item set changed between when the
    // participant started and when this code first runs for their session".
    const session = await makeSession(`in-flight-${ts}@test.local`);
    try {
      await adminDb.from("participant_responses").insert({
        session_id: session.sessionId,
        item_id: ids.itemTwo,
        section_id: ids.section,
        response_value: 3,
      });

      await adminDb
        .from("assessment_section_items")
        .delete()
        .eq("section_id", ids.section)
        .eq("item_id", ids.itemTwo);

      try {
        const forms = await getOrCreateSectionForms(adminDb, {
          sessionId: session.sessionId,
          assessmentId: ids.assessment,
          campaignId: ids.campaign,
        });
        if ("error" in forms) throw new Error(forms.error);

        const entries = forms.get(ids.section)!.entries;
        const itemIds = entries.map((e) => e.itemId);
        // itemOne + itemThree are the fresh computation; itemTwo is reconciled
        // back in because it already had a saved response for this session.
        expect(itemIds).toContain(ids.itemOne);
        expect(itemIds).toContain(ids.itemThree);
        expect(itemIds).toContain(ids.itemTwo);
        expect(itemIds).toHaveLength(3);
      } finally {
        // Restore section membership for any tests that run after this one.
        await adminDb
          .from("assessment_section_items")
          .upsert(
            { section_id: ids.section, item_id: ids.itemTwo, display_order: 1 },
            { onConflict: "section_id,item_id" },
          );
      }
    } finally {
      await cleanupSession(session);
    }
  });
});
