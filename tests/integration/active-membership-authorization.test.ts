import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient, createTestUser } from "./_helpers/rls-fixture";

// Real OTP sessions + invitation-shaped profiles exercise the Data API boundary,
// including the parent partner_id that made client users inherit sibling access.
const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
type Actor = { userId: string; client: SupabaseClient };

describe.skipIf(!canRun)("active membership authorization", () => {
  const admin = createAdminClient();
  const ids = { partnerA: "", partnerB: "", clientA1: "", clientA2: "", clientB: "" };
  const actors: Record<string, Actor> = {};
  const campaigns: string[] = [];
  const participants: string[] = [];
  const sessions: string[] = [];
  let assessmentId = "";

  async function insert(table: string, row: Record<string, unknown>) {
    const { data, error } = await admin.from(table).insert(row).select("id").single();
    if (error) throw new Error(`${table}: ${error.message}`);
    return String(data.id);
  }

  async function clientsVisibleTo(actor: Actor) {
    const { data, error } = await actor.client.from("clients").select("id")
      .in("id", [ids.clientA1, ids.clientA2, ids.clientB]);
    expect(error).toBeNull();
    return (data ?? []).map((row) => row.id).sort();
  }

  async function participantsVisibleTo(actor: Actor) {
    const { data, error } = await actor.client.from("campaign_participants")
      .select("id,email").in("id", participants);
    expect(error).toBeNull();
    return (data ?? []).map((row) => row.id);
  }

  async function setActive(actor: Actor, value: boolean) {
    const { error } = await admin.from("profiles").update({ is_active: value }).eq("id", actor.userId);
    expect(error).toBeNull();
  }

  beforeAll(async () => {
    for (const label of ["partnerA", "partnerB"] as const) {
      ids[label] = await insert("partners", { name: `Auth ${label}`, slug: `auth-${label.toLowerCase()}-${stamp}` });
    }
    for (const label of ["clientA1", "clientA2", "clientB"] as const) {
      ids[label] = await insert("clients", {
        name: `Auth ${label}`, slug: `auth-${label.toLowerCase()}-${stamp}`,
        partner_id: label === "clientB" ? ids.partnerB : ids.partnerA,
      });
      const campaign = await insert("campaigns", {
        title: `Auth ${label}`, slug: `auth-campaign-${label.toLowerCase()}-${stamp}`,
        client_id: ids[label], partner_id: label === "clientB" ? ids.partnerB : ids.partnerA,
      });
      campaigns.push(campaign);
      participants.push(await insert("campaign_participants", {
        campaign_id: campaign, email: `auth-participant-${label.toLowerCase()}-${stamp}@test.local`,
      }));
    }
    for (const [label, role] of [["clientAdmin", "org_admin"], ["clientMember", "consultant"]] as const) {
      actors[label] = await createTestUser(admin, {
        email: `auth-${label.toLowerCase()}-${stamp}@test.local`, role,
        clientId: ids.clientA1, partnerId: ids.partnerA,
      });
      await insert("client_memberships", {
        profile_id: actors[label].userId, client_id: ids.clientA1,
        role: label === "clientAdmin" ? "admin" : "member",
      });
    }
    for (const [label, role] of [["partnerAdmin", "partner_admin"], ["partnerMember", "consultant"]] as const) {
      actors[label] = await createTestUser(admin, {
        email: `auth-${label.toLowerCase()}-${stamp}@test.local`, role, partnerId: ids.partnerA,
      });
      await insert("partner_memberships", {
        profile_id: actors[label].userId, partner_id: ids.partnerA,
        role: label === "partnerAdmin" ? "admin" : "member",
      });
    }
    actors.platformAdmin = await createTestUser(admin, {
      email: `auth-platform-${stamp}@test.local`, role: "platform_admin",
    });
    // Deliberately no memberships: denormalized columns must grant nothing.
    actors.legacyOnly = await createTestUser(admin, {
      email: `auth-legacy-${stamp}@test.local`, role: "partner_admin",
      partnerId: ids.partnerB, clientId: ids.clientB,
    });
    actors.participant = await createTestUser(admin, {
      email: `auth-participant-profile-${stamp}@test.local`, role: "consultant",
    });
    const participantRole = await admin.from("profiles").update({ role: "candidate" }).eq("id", actors.participant.userId);
    expect(participantRole.error).toBeNull();
    assessmentId = await insert("assessments", { title: `Auth participant ${stamp}`, slug: `auth-participant-${stamp}` });
    sessions.push(await insert("participant_sessions", {
      assessment_id: assessmentId, participant_profile_id: actors.participant.userId,
      campaign_participant_id: participants[0], campaign_id: campaigns[0], client_id: ids.clientA1,
    }));
    sessions.push(await insert("participant_sessions", {
      assessment_id: assessmentId, campaign_participant_id: participants[2],
      campaign_id: campaigns[2], client_id: ids.clientB,
    }));
  }, 60_000);

  afterAll(async () => {
    if (sessions.length) {
      const { error } = await admin.from("participant_sessions").delete().in("id", sessions);
      expect(error).toBeNull();
    }
    for (const actor of Object.values(actors)) {
      const { error } = await admin.auth.admin.deleteUser(actor.userId);
      expect(error).toBeNull();
    }
    for (const [table, rowIds] of [
      ["campaign_participants", participants], ["campaigns", campaigns],
      ["assessments", [assessmentId]],
      ["clients", [ids.clientA1, ids.clientA2, ids.clientB]],
      ["partners", [ids.partnerA, ids.partnerB]],
    ] as const) {
      const present = rowIds.filter(Boolean);
      if (!present.length) continue;
      const { error } = await admin.from(table).delete().in("id", present);
      expect(error).toBeNull();
    }
  }, 30_000);

  it.each(["clientAdmin", "clientMember"])("%s sees only the invited client and its participants", async (label) => {
    expect(await clientsVisibleTo(actors[label])).toEqual([ids.clientA1]);
    expect(await participantsVisibleTo(actors[label])).toEqual([participants[0]]);
    const { data, error } = await actors[label].client.rpc("auth_user_partner_ids");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it.each(["partnerAdmin", "partnerMember"])("%s reads own partner clients but never the other partner", async (label) => {
    expect(await clientsVisibleTo(actors[label])).toEqual([ids.clientA1, ids.clientA2].sort());
    expect((await participantsVisibleTo(actors[label])).sort()).toEqual(participants.slice(0, 2).sort());
  });

  it("partner admin can update own client and member cannot", async () => {
    const allowed = await actors.partnerAdmin.client.from("clients")
      .update({ industry: "authorization regression" }).eq("id", ids.clientA1).select("id");
    expect(allowed.error).toBeNull();
    expect(allowed.data).toEqual([{ id: ids.clientA1 }]);
    for (const [actor, target] of [[actors.partnerMember, ids.clientA1], [actors.partnerAdmin, ids.clientB]] as const) {
      const denied = await actor.client.from("clients").update({ industry: "forbidden" }).eq("id", target).select("id");
      expect(denied.error).toBeNull();
      expect(denied.data).toEqual([]);
    }
  });

  it("profile tenant columns alone never grant read or admin authority", async () => {
    expect(await clientsVisibleTo(actors.legacyOnly)).toEqual([]);
    for (const fn of ["auth_user_partner_ids", "auth_user_client_ids", "auth_user_partner_admin_ids", "auth_user_client_admin_ids"]) {
      const { data, error } = await actors.legacyOnly.client.rpc(fn);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });

  it.each(["clientAdmin", "clientMember", "partnerAdmin", "partnerMember"])("revoking %s membership removes access without clearing profile columns", async (label) => {
    const actor = actors[label];
    const table = label.startsWith("client") ? "client_memberships" : "partner_memberships";
    const revoked = await admin.from(table).update({ revoked_at: new Date().toISOString() }).eq("profile_id", actor.userId);
    expect(revoked.error).toBeNull();
    try {
      expect(await clientsVisibleTo(actor)).toEqual([]);
      expect(await participantsVisibleTo(actor)).toEqual([]);
    } finally {
      const restored = await admin.from(table).update({ revoked_at: null }).eq("profile_id", actor.userId);
      expect(restored.error).toBeNull();
    }
  });

  it.each(["clientAdmin", "clientMember", "partnerAdmin", "partnerMember", "platformAdmin"])("deactivating %s blocks the existing OTP session immediately", async (label) => {
    const actor = actors[label];
    await setActive(actor, false);
    try {
      expect(await clientsVisibleTo(actor)).toEqual([]);
      expect(await participantsVisibleTo(actor)).toEqual([]);
      const ownProfile = await actor.client.from("profiles").select("id").eq("id", actor.userId);
      expect(ownProfile.error).toBeNull();
      expect(ownProfile.data).toEqual([]);
      for (const fn of ["auth_user_partner_ids", "auth_user_client_ids", "auth_user_partner_admin_ids", "auth_user_client_admin_ids"]) {
        const result = await actor.client.rpc(fn);
        expect(result.error).toBeNull();
        expect(result.data).toEqual([]);
      }
      const adminRole = await actor.client.rpc("is_platform_admin");
      expect(adminRole.error).toBeNull();
      expect(adminRole.data).toBe(false);
      const mutation = await actor.client.from("clients").update({ industry: "inactive" }).eq("id", ids.clientA1).select("id");
      expect(mutation.error).toBeNull();
      expect(mutation.data).toEqual([]);
    } finally { await setActive(actor, true); }
    expect((await clientsVisibleTo(actor)).length).toBeGreaterThan(0);
  });

  it("inactive platform admin cannot retain support authority", async () => {
    const actor = actors.platformAdmin;
    const supportId = await insert("support_sessions", {
      actor_profile_id: actor.userId, target_surface: "client", client_id: ids.clientA1,
      reason: "Active account regression", expires_at: new Date(Date.now() + 600_000).toISOString(),
    });
    try {
      expect(await clientsVisibleTo(actor)).toEqual([ids.clientA1]);
      await setActive(actor, false);
      expect(await clientsVisibleTo(actor)).toEqual([]);
      const result = await actor.client.rpc("auth_in_support_session");
      expect(result.error).toBeNull();
      expect(result.data).toBe(false);
    } finally {
      await admin.from("support_sessions").delete().eq("id", supportId);
      await setActive(actor, true);
    }
  });

  it("active users can change their own names without recursive RLS", async () => {
    const actor = actors.clientMember;
    const result = await actor.client.from("profiles").update({ display_name: "Safe self-service" })
      .eq("id", actor.userId).select("display_name");
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ display_name: "Safe self-service" }]);
    const other = await actor.client.from("profiles").update({ display_name: "Forbidden" })
      .eq("id", actors.clientAdmin.userId).select("id");
    expect(other.error).toBeNull();
    expect(other.data).toEqual([]);
  });

  it.each(["role", "partner_id", "client_id", "is_active", "email", "scheduled_deletion_at"])("self-service cannot write privileged profile column %s", async (column) => {
    const values: Record<string, unknown> = {
      role: "platform_admin", partner_id: ids.partnerB, client_id: ids.clientB,
      is_active: true, email: `forbidden-${stamp}@test.local`, scheduled_deletion_at: new Date().toISOString(),
    };
    const result = await actors.clientMember.client.from("profiles").update({ [column]: values[column] })
      .eq("id", actors.clientMember.userId);
    expect(result.error?.code).toBe("42501");
  });

  it("an active authenticated participant without tenant membership retains own-session access only", async () => {
    const actor = actors.participant;
    const own = await actor.client.from("participant_sessions").select("id").in("id", sessions);
    expect(own.error).toBeNull();
    expect(own.data).toEqual([{ id: sessions[0] }]);
    expect(await clientsVisibleTo(actor)).toEqual([]);
    await setActive(actor, false);
    try {
      const denied = await actor.client.from("participant_sessions").select("id").in("id", sessions);
      expect(denied.error).toBeNull();
      expect(denied.data).toEqual([]);
    } finally { await setActive(actor, true); }
  });

  it("a demoted platform administrator cannot use a lingering support session", async () => {
    const actor = actors.platformAdmin;
    const supportId = await insert("support_sessions", {
      actor_profile_id: actor.userId, target_surface: "client", client_id: ids.clientA1,
      reason: "Demotion regression", expires_at: new Date(Date.now() + 600_000).toISOString(),
    });
    try {
      const demoted = await admin.from("profiles").update({ role: "consultant" }).eq("id", actor.userId);
      expect(demoted.error).toBeNull();
      expect(await clientsVisibleTo(actor)).toEqual([]);
      const result = await actor.client.rpc("auth_in_support_session");
      expect(result.error).toBeNull();
      expect(result.data).toBe(false);
    } finally {
      await admin.from("support_sessions").delete().eq("id", supportId);
      const restored = await admin.from("profiles").update({ role: "platform_admin" }).eq("id", actor.userId);
      expect(restored.error).toBeNull();
    }
  });
});
