/**
 * Integration tests for partner-managed clients (Phase 1 of
 * docs/superpowers/plans/2026-09-04-partner-self-service.md).
 *
 * Two things the database must hold regardless of what the app does:
 *
 *   1. RLS still refuses direct entitlement writes by a partner admin (D2) —
 *      partner writes go through the Server Actions on the service role.
 *   2. The pool trigger refuses an ACTIVE client assignment for a partner-owned
 *      client unless the assessment is in the partner's allocation or owned by
 *      that partner / that client (D4) — for every actor, service role included.
 *
 * Fixture hierarchy:
 *   Partner A  ── Client A1
 *     pool: assessment X (quota 10)
 *     owns: assessment Z
 *     Client A1 owns: assessment W
 *   Partner B  ── Client B1
 *   Platform-owned client P (no partner)
 *   Assessment Y: in no pool, owned by nobody
 *
 * Requires a running LOCAL Supabase instance with env vars:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  canRun,
  createAdminClient,
  createTestUser,
} from "./_helpers/rls-fixture";

const ts = Date.now();

function testEmail(label: string) {
  return `pmc-${label}-${ts}@test.local`;
}

function testSlug(label: string) {
  return `pmc-${label}-${ts}`;
}

describe.skipIf(!canRun)("partner-managed clients (RLS + pool trigger)", () => {
  const adminDb = createAdminClient();

  let partnerAAdminDb: SupabaseClient;

  const ids = {
    partnerA: "",
    partnerB: "",
    clientA1: "",
    clientB1: "",
    clientP: "",
    assessmentX: "",
    assessmentY: "",
    assessmentZ: "",
    assessmentW: "",
    poolRowX: "",
  };

  const authUserIds: string[] = [];
  const assignmentIdsToClean: string[] = [];

  async function insertAssessment(label: string, extra: Record<string, unknown> = {}) {
    const { data, error } = await adminDb
      .from("assessments")
      .insert({
        title: `Assessment ${label} ${ts}`,
        slug: testSlug(`ass-${label.toLowerCase()}`),
        status: "active",
        ...extra,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`insert assessment ${label}: ${error?.message}`);
    return String(data.id);
  }

  beforeAll(async () => {
    // --- Partners ---
    const { data: pA } = await adminDb
      .from("partners")
      .insert({ name: `Partner A ${ts}`, slug: testSlug("pa") })
      .select("id")
      .single();
    ids.partnerA = pA!.id;

    const { data: pB } = await adminDb
      .from("partners")
      .insert({ name: `Partner B ${ts}`, slug: testSlug("pb") })
      .select("id")
      .single();
    ids.partnerB = pB!.id;

    // --- Clients ---
    const { data: cA1 } = await adminDb
      .from("clients")
      .insert({ name: `Client A1 ${ts}`, slug: testSlug("ca1"), partner_id: ids.partnerA })
      .select("id")
      .single();
    ids.clientA1 = cA1!.id;

    const { data: cB1 } = await adminDb
      .from("clients")
      .insert({ name: `Client B1 ${ts}`, slug: testSlug("cb1"), partner_id: ids.partnerB })
      .select("id")
      .single();
    ids.clientB1 = cB1!.id;

    const { data: cP } = await adminDb
      .from("clients")
      .insert({ name: `Client P ${ts}`, slug: testSlug("cp") })
      .select("id")
      .single();
    ids.clientP = cP!.id;

    // --- Assessments ---
    ids.assessmentX = await insertAssessment("X");
    ids.assessmentY = await insertAssessment("Y");
    ids.assessmentZ = await insertAssessment("Z", { partner_id: ids.partnerA });
    ids.assessmentW = await insertAssessment("W", { client_id: ids.clientA1 });

    // --- Users ---
    const partnerAAdmin = await createTestUser(adminDb, {
      email: testEmail("partner-a-admin"),
      role: "partner_admin",
      partnerId: ids.partnerA,
    });
    partnerAAdminDb = partnerAAdmin.client;
    authUserIds.push(partnerAAdmin.userId);
    await adminDb.from("partner_memberships").insert({
      profile_id: partnerAAdmin.userId,
      partner_id: ids.partnerA,
      role: "admin",
    });

    // --- Partner A's allocation: assessment X, capped at 10 ---
    const { data: pool, error: poolError } = await adminDb
      .from("partner_assessment_assignments")
      .insert({
        partner_id: ids.partnerA,
        assessment_id: ids.assessmentX,
        quota_limit: 10,
        assigned_by: partnerAAdmin.userId,
      })
      .select("id")
      .single();
    if (poolError || !pool) throw new Error(`insert pool row: ${poolError?.message}`);
    ids.poolRowX = String(pool.id);
  }, 30_000);

  afterAll(async () => {
    if (!canRun) return;

    if (assignmentIdsToClean.length > 0) {
      await adminDb.from("client_assessment_assignments").delete().in("id", assignmentIdsToClean);
    }
    await adminDb
      .from("client_assessment_assignments")
      .delete()
      .in("client_id", [ids.clientA1, ids.clientB1, ids.clientP]);
    await adminDb.from("partner_assessment_assignments").delete().eq("id", ids.poolRowX);
    await adminDb
      .from("assessments")
      .delete()
      .in("id", [ids.assessmentX, ids.assessmentY, ids.assessmentZ, ids.assessmentW]);
    await adminDb.from("partner_memberships").delete().in("partner_id", [ids.partnerA, ids.partnerB]);
    await adminDb.from("clients").delete().in("id", [ids.clientA1, ids.clientB1, ids.clientP]);
    await adminDb.from("partners").delete().in("id", [ids.partnerA, ids.partnerB]);

    for (const uid of authUserIds) {
      await adminDb.from("profiles").delete().eq("id", uid);
      await adminDb.auth.admin.deleteUser(uid);
    }
  }, 15_000);

  // -------------------------------------------------------------------------
  // D2: direct entitlement writes stay platform-admin-only at the RLS layer
  // -------------------------------------------------------------------------
  describe("RLS keeps entitlement writes off the partner admin's authenticated client", () => {
    it("partner A admin cannot INSERT a client assignment directly, even for their own client", async () => {
      const { error } = await partnerAAdminDb.from("client_assessment_assignments").insert({
        client_id: ids.clientA1,
        assessment_id: ids.assessmentX,
        quota_limit: 5,
      });
      expect(error).not.toBeNull();

      const { data: leaked } = await adminDb
        .from("client_assessment_assignments")
        .select("id")
        .eq("client_id", ids.clientA1)
        .eq("assessment_id", ids.assessmentX);
      expect(leaked ?? []).toHaveLength(0);
    });

    it("partner A admin cannot INSERT a report template assignment directly", async () => {
      const { error } = await partnerAAdminDb.from("client_report_template_assignments").insert({
        client_id: ids.clientA1,
        report_template_id: ids.assessmentX, // any uuid — RLS rejects before FK
      });
      expect(error).not.toBeNull();
    });

    it("partner A admin can still READ their own client's assignments and not partner B's", async () => {
      // Seed one legitimate row through the service role.
      const { data: row, error } = await adminDb
        .from("client_assessment_assignments")
        .insert({ client_id: ids.clientA1, assessment_id: ids.assessmentX, quota_limit: 5 })
        .select("id")
        .single();
      expect(error).toBeNull();
      assignmentIdsToClean.push(String(row!.id));

      const { data: own } = await partnerAAdminDb
        .from("client_assessment_assignments")
        .select("id")
        .eq("client_id", ids.clientA1);
      expect((own ?? []).map((r) => String(r.id))).toContain(String(row!.id));

      const { data: other } = await partnerAAdminDb
        .from("client_assessment_assignments")
        .select("id")
        .eq("client_id", ids.clientB1);
      expect(other ?? []).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // D4: the pool trigger binds every actor, including the service role
  // -------------------------------------------------------------------------
  describe("pool trigger (enforce_client_assignment_in_partner_pool)", () => {
    it("accepts a partner-owned assessment without a pool row", async () => {
      const { data, error } = await adminDb
        .from("client_assessment_assignments")
        .insert({ client_id: ids.clientA1, assessment_id: ids.assessmentZ })
        .select("id")
        .single();
      expect(error).toBeNull();
      assignmentIdsToClean.push(String(data!.id));
    });

    it("accepts a client-owned assessment without a pool row", async () => {
      const { data, error } = await adminDb
        .from("client_assessment_assignments")
        .insert({ client_id: ids.clientA1, assessment_id: ids.assessmentW })
        .select("id")
        .single();
      expect(error).toBeNull();
      assignmentIdsToClean.push(String(data!.id));
    });

    it("accepts any assessment for a platform-owned client", async () => {
      const { data, error } = await adminDb
        .from("client_assessment_assignments")
        .insert({ client_id: ids.clientP, assessment_id: ids.assessmentY })
        .select("id")
        .single();
      expect(error).toBeNull();
      assignmentIdsToClean.push(String(data!.id));
    });

    it("refuses an assessment that is in no pool and owned by nobody", async () => {
      const { data, error } = await adminDb
        .from("client_assessment_assignments")
        .insert({ client_id: ids.clientA1, assessment_id: ids.assessmentY })
        .select("id")
        .single();
      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error!.message).toContain("not in the partner pool");
    });

    it("refuses an assessment that is only in ANOTHER partner's pool", async () => {
      // Client B1 (partner B) tries to use assessment X, which is in partner A's pool.
      const { error } = await adminDb
        .from("client_assessment_assignments")
        .insert({ client_id: ids.clientB1, assessment_id: ids.assessmentX });
      expect(error).not.toBeNull();
      expect(error!.message).toContain("not in the partner pool");
    });

    it("lets an in-pool row be deactivated and refuses re-activation once the pool row is gone", async () => {
      const { data: row, error: insertError } = await adminDb
        .from("client_assessment_assignments")
        .insert({ client_id: ids.clientA1, assessment_id: ids.assessmentX, quota_limit: 3 })
        .select("id")
        .single();
      // X is already assigned to A1 by the read test above → unique violation is
      // possible; fall back to that existing row.
      let assignmentId: string;
      if (insertError) {
        const { data: existing } = await adminDb
          .from("client_assessment_assignments")
          .select("id")
          .eq("client_id", ids.clientA1)
          .eq("assessment_id", ids.assessmentX)
          .single();
        assignmentId = String(existing!.id);
      } else {
        assignmentId = String(row!.id);
        assignmentIdsToClean.push(assignmentId);
      }

      const { error: deactivateError } = await adminDb
        .from("client_assessment_assignments")
        .update({ is_active: false })
        .eq("id", assignmentId);
      expect(deactivateError).toBeNull();

      // Remove X from partner A's allocation, then try to switch the row back on.
      await adminDb
        .from("partner_assessment_assignments")
        .update({ is_active: false })
        .eq("id", ids.poolRowX);

      const { error: reactivateError } = await adminDb
        .from("client_assessment_assignments")
        .update({ is_active: true })
        .eq("id", assignmentId);
      expect(reactivateError).not.toBeNull();
      expect(reactivateError!.message).toContain("not in the partner pool");

      // Restore the allocation; re-activation now succeeds.
      await adminDb
        .from("partner_assessment_assignments")
        .update({ is_active: true })
        .eq("id", ids.poolRowX);
      const { error: restoredError } = await adminDb
        .from("client_assessment_assignments")
        .update({ is_active: true })
        .eq("id", assignmentId);
      expect(restoredError).toBeNull();
    });
  });
});
