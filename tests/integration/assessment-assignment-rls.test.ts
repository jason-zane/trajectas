/**
 * Integration tests for the entitlement arm of the `assessments` SELECT policy
 * (20260904160000_assessments_select_assigned.sql).
 *
 * Every other arm of the policy scopes by an OWNERSHIP column on the
 * assessment row. Entitlement is not ownership: `client_assessment_assignments`
 * is how a client is granted an assessment somebody else owns, and until that
 * migration no policy on `assessments` consulted it. The consequence was that
 * `getClientAssessmentLibrary()` worked (it reads on the service-role client,
 * bypassing RLS) while every RLS-native reader — the grounded-chat tools in
 * src/lib/chat/tools/, src/lib/dal/chat-search.ts — returned not_found for an
 * assessment the client legitimately uses.
 *
 * Fixture:
 *   Partner A ── Client A1  ← the member under test
 *   Partner B ── Client B1
 *
 *   assignedToA1   partner-A-owned, ACTIVE assignment to Client A1   → visible
 *   unassignedA    partner-A-owned, no assignment                    → hidden
 *   otherTenant    partner-B-owned, no assignment                    → hidden
 *   revokedForA1   partner-A-owned, is_active = false                → hidden
 *   assignedToB1   partner-B-owned, ACTIVE assignment to Client B1   → hidden
 *
 * `unassignedA` is the control that makes the positive case mean something:
 * it is owned by the same partner as `assignedToA1`, so if it were visible the
 * grant would be coming from ownership rather than from the assignment.
 *
 * Note every fixture assessment is partner-OWNED. A platform-owned assessment
 * (partner_id and client_id both NULL) is already world-readable to any
 * authenticated user through the policy's pre-existing
 * `(partner_id IS NULL AND client_id IS NULL)` arm, so it cannot distinguish
 * the new arm from the old ones.
 *
 * Requires a running LOCAL Supabase instance — see the host guard below.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient, createTestUser } from "./_helpers/rls-fixture";

const ts = Date.now();

function testEmail(label: string) {
  return `rls-caa-${label}-${ts}@test.local`;
}

function testSlug(label: string) {
  return `rls-caa-${label}-${ts}`;
}

describe.skipIf(!canRun)("assessments SELECT: entitlement via assignment (RLS)", () => {
  const adminDb = createAdminClient();

  let clientA1MemberDb: SupabaseClient;

  const ids = {
    partnerA: "",
    partnerB: "",
    clientA1: "",
    clientB1: "",
    assignedToA1: "",
    unassignedA: "",
    otherTenant: "",
    revokedForA1: "",
    assignedToB1: "",
  };

  const authUserIds: string[] = [];

  /** Insert a partner-owned assessment and return its id. */
  async function makeAssessment(label: string, partnerId: string) {
    const { data, error } = await adminDb
      .from("assessments")
      .insert({
        title: `Assessment ${label} ${ts}`,
        slug: testSlug(label),
        partner_id: partnerId,
        client_id: null,
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert assessment ${label}: ${error.message}`);
    return data!.id as string;
  }

  beforeAll(async () => {
    if (!canRun) return;

    const { data: pA, error: pAErr } = await adminDb
      .from("partners")
      .insert({ name: `Partner A ${ts}`, slug: testSlug("pa") })
      .select("id")
      .single();
    if (pAErr) throw new Error(`insert partner A: ${pAErr.message}`);
    ids.partnerA = pA!.id;

    const { data: pB, error: pBErr } = await adminDb
      .from("partners")
      .insert({ name: `Partner B ${ts}`, slug: testSlug("pb") })
      .select("id")
      .single();
    if (pBErr) throw new Error(`insert partner B: ${pBErr.message}`);
    ids.partnerB = pB!.id;

    const { data: cA1, error: cA1Err } = await adminDb
      .from("clients")
      .insert({ name: `Client A1 ${ts}`, slug: testSlug("ca1"), partner_id: ids.partnerA })
      .select("id")
      .single();
    if (cA1Err) throw new Error(`insert client A1: ${cA1Err.message}`);
    ids.clientA1 = cA1!.id;

    const { data: cB1, error: cB1Err } = await adminDb
      .from("clients")
      .insert({ name: `Client B1 ${ts}`, slug: testSlug("cb1"), partner_id: ids.partnerB })
      .select("id")
      .single();
    if (cB1Err) throw new Error(`insert client B1: ${cB1Err.message}`);
    ids.clientB1 = cB1!.id;

    ids.assignedToA1 = await makeAssessment("assigned-a1", ids.partnerA);
    ids.unassignedA = await makeAssessment("unassigned-a", ids.partnerA);
    ids.otherTenant = await makeAssessment("other-tenant", ids.partnerB);
    ids.revokedForA1 = await makeAssessment("revoked-a1", ids.partnerA);
    ids.assignedToB1 = await makeAssessment("assigned-b1", ids.partnerB);

    // A platform admin to own the `assigned_by` audit column.
    const platformAdmin = await createTestUser(adminDb, {
      email: testEmail("platform-admin"),
      role: "platform_admin",
    });
    authUserIds.push(platformAdmin.userId);

    const { error: caaErr } = await adminDb.from("client_assessment_assignments").insert([
      {
        client_id: ids.clientA1,
        assessment_id: ids.assignedToA1,
        is_active: true,
        assigned_by: platformAdmin.userId,
      },
      {
        client_id: ids.clientA1,
        assessment_id: ids.revokedForA1,
        is_active: false,
        assigned_by: platformAdmin.userId,
      },
      {
        client_id: ids.clientB1,
        assessment_id: ids.assignedToB1,
        is_active: true,
        assigned_by: platformAdmin.userId,
      },
    ]);
    if (caaErr) throw new Error(`insert assignments: ${caaErr.message}`);

    // The member under test: an ordinary Client A1 member, no partner rights.
    const clientA1Member = await createTestUser(adminDb, {
      email: testEmail("client-a1-member"),
      role: "org_admin",
      clientId: ids.clientA1,
    });
    clientA1MemberDb = clientA1Member.client;
    authUserIds.push(clientA1Member.userId);

    const { error: cmErr } = await adminDb.from("client_memberships").insert({
      profile_id: clientA1Member.userId,
      client_id: ids.clientA1,
      role: "admin",
    });
    if (cmErr) throw new Error(`insert client membership: ${cmErr.message}`);
  }, 90_000);

  afterAll(async () => {
    if (!canRun) return;

    await adminDb
      .from("client_assessment_assignments")
      .delete()
      .in("client_id", [ids.clientA1, ids.clientB1]);

    await adminDb
      .from("assessments")
      .delete()
      .in("id", [
        ids.assignedToA1,
        ids.unassignedA,
        ids.otherTenant,
        ids.revokedForA1,
        ids.assignedToB1,
      ]);

    await adminDb
      .from("client_memberships")
      .delete()
      .in("client_id", [ids.clientA1, ids.clientB1]);

    await adminDb.from("clients").delete().in("id", [ids.clientA1, ids.clientB1]);
    await adminDb.from("partners").delete().in("id", [ids.partnerA, ids.partnerB]);

    for (const uid of authUserIds) {
      await adminDb.from("profiles").delete().eq("id", uid);
      await adminDb.auth.admin.deleteUser(uid);
    }
  }, 30_000);

  it("reads an assessment its client is actively assigned but does not own", async () => {
    const { data, error } = await clientA1MemberDb
      .from("assessments")
      .select("id, title")
      .eq("id", ids.assignedToA1);

    expect(error).toBeNull();
    expect((data ?? []).map((r) => r.id)).toEqual([ids.assignedToA1]);
  });

  it("cannot read an unassigned assessment from another tenant", async () => {
    const { data, error } = await clientA1MemberDb
      .from("assessments")
      .select("id")
      .eq("id", ids.otherTenant);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot read an unassigned assessment owned by the same partner", async () => {
    // The control for the positive case: same owner as `assignedToA1`, so a
    // hit here would mean the grant came from ownership, not the assignment.
    const { data, error } = await clientA1MemberDb
      .from("assessments")
      .select("id")
      .eq("id", ids.unassignedA);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot read an assessment whose assignment is inactive", async () => {
    // is_active is the table's entire revocation story — there is no
    // revoked_at / expires_at column for the policy to honour instead.
    const { data, error } = await clientA1MemberDb
      .from("assessments")
      .select("id")
      .eq("id", ids.revokedForA1);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot read an assessment assigned to a different client", async () => {
    const { data, error } = await clientA1MemberDb
      .from("assessments")
      .select("id")
      .eq("id", ids.assignedToB1);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("loses the assessment again when the assignment is deactivated", async () => {
    // Revocation must take effect on the next read, not at next sign-in:
    // the policy consults the row, so there is no cached grant to go stale.
    const { error: offErr } = await adminDb
      .from("client_assessment_assignments")
      .update({ is_active: false })
      .eq("client_id", ids.clientA1)
      .eq("assessment_id", ids.assignedToA1);
    expect(offErr).toBeNull();

    const { data: afterRevoke } = await clientA1MemberDb
      .from("assessments")
      .select("id")
      .eq("id", ids.assignedToA1);
    expect(afterRevoke ?? []).toHaveLength(0);

    const { error: onErr } = await adminDb
      .from("client_assessment_assignments")
      .update({ is_active: true })
      .eq("client_id", ids.clientA1)
      .eq("assessment_id", ids.assignedToA1);
    expect(onErr).toBeNull();

    const { data: afterRestore } = await clientA1MemberDb
      .from("assessments")
      .select("id")
      .eq("id", ids.assignedToA1);
    expect((afterRestore ?? []).map((r) => r.id)).toEqual([ids.assignedToA1]);
  });

  it("still cannot WRITE an assessment it is only assigned", async () => {
    // An assignment grants use, never authorship. The migration adds a SELECT
    // policy only; if that ever widens, this fails.
    const { data } = await clientA1MemberDb
      .from("assessments")
      .update({ title: `hijacked ${ts}` })
      .eq("id", ids.assignedToA1)
      .select("id");
    expect(data ?? []).toHaveLength(0);

    const { data: verify } = await adminDb
      .from("assessments")
      .select("title")
      .eq("id", ids.assignedToA1)
      .single();
    expect(verify?.title).toBe(`Assessment assigned-a1 ${ts}`);
  });

  it("cannot DELETE an assessment it is only assigned", async () => {
    const { data } = await clientA1MemberDb
      .from("assessments")
      .delete()
      .eq("id", ids.assignedToA1)
      .select("id");
    expect(data ?? []).toHaveLength(0);

    const { count } = await adminDb
      .from("assessments")
      .select("id", { count: "exact", head: true })
      .eq("id", ids.assignedToA1);
    expect(count).toBe(1);
  });
});
