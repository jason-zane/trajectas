/**
 * A support session confines a platform admin IN THE DATABASE.
 *
 * Contract (see 20260904120000_support_sessions_confine_rls.sql):
 *
 * A platform admin normally reads every tenant's rows through
 * is_platform_admin(), which is role-only. While they hold a live row in
 * support_sessions, reads on tenant-scoped tables narrow to that session's
 * target and nothing else — without the application supplying any context,
 * because the cookie carrying the active workspace never reaches Postgres.
 *
 * The tests below open a session against ONE of two clients and assert both
 * directions: the target is still visible (a confinement that blinded support
 * would be useless) and the other client has disappeared. They then end the
 * session and assert the admin is restored, so the narrowing is genuinely
 * scoped to the session's lifetime rather than a one-way door.
 *
 * The two negative cases matter as much as the positive ones:
 *   - an EXPIRED session must not confine (or an admin is stuck forever);
 *   - confinement must not leak to ordinary client members, whose access is
 *     unchanged by this migration.
 *
 * Mirrors the fixture/host-guard pattern of the other RLS suites — these
 * tests only run against a local Supabase stack.
 */

import { type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  canRun,
  createAdminClient,
  createTestUser,
} from "./_helpers/rls-fixture";

const ts = Date.now();
const testEmail = (label: string) => `rls-support-${label}-${ts}@test.local`;
// Lowercased: campaigns_slug_format is `^[a-z0-9][a-z0-9-]*[a-z0-9]$` against a
// plain `text` column, so a label like "campaignA" is rejected. (clients.slug is
// citext and would have accepted it, which is exactly how this stays hidden.)
const testSlug = (label: string) => `rls-support-${label.toLowerCase()}-${ts}`;

/** Rows the admin client must clean up, newest dependency first. */
type Cleanup = { table: string; ids: string[] };

describe.skipIf(!canRun)("support session confinement (RLS)", () => {
  const adminDb = createAdminClient();

  let platformAdminDb: SupabaseClient;
  let memberDb: SupabaseClient;
  let platformAdminId = "";

  const ids = {
    clientA: "",
    clientB: "",
    campaignA: "",
    campaignB: "",
    participantA: "",
    participantB: "",
  };
  const authUserIds: string[] = [];
  const supportSessionIds: string[] = [];

  /** Opens a live support session for the platform admin against `clientId`. */
  async function openSupportSession(clientId: string, expiresAt?: string) {
    const { data, error } = await adminDb
      .from("support_sessions")
      .insert({
        actor_profile_id: platformAdminId,
        target_surface: "client",
        client_id: clientId,
        reason: "RLS confinement test",
        expires_at:
          expiresAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`support session insert: ${error.message}`);
    supportSessionIds.push(data!.id);
    return data!.id as string;
  }

  async function endSupportSession(sessionId: string) {
    const { error } = await adminDb
      .from("support_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (error) throw new Error(`support session end: ${error.message}`);
  }

  /** Client ids visible to `db` — the observable form of the boundary. */
  async function visibleClientIds(db: SupabaseClient) {
    const { data, error } = await db
      .from("clients")
      .select("id")
      .in("id", [ids.clientA, ids.clientB]);
    if (error) throw new Error(`clients select: ${error.message}`);
    return (data ?? []).map((row) => row.id as string).sort();
  }

  async function visibleParticipantIds(db: SupabaseClient) {
    const { data, error } = await db
      .from("campaign_participants")
      .select("id")
      .in("id", [ids.participantA, ids.participantB]);
    if (error) throw new Error(`participants select: ${error.message}`);
    return (data ?? []).map((row) => row.id as string).sort();
  }

  beforeAll(async () => {
    if (!canRun) return;

    for (const key of ["clientA", "clientB"] as const) {
      const { data, error } = await adminDb
        .from("clients")
        .insert({ name: `Support ${key} ${ts}`, slug: testSlug(key) })
        .select("id")
        .single();
      if (error) throw new Error(`client insert: ${error.message}`);
      ids[key] = data!.id;
    }

    for (const [campaignKey, clientKey] of [
      ["campaignA", "clientA"],
      ["campaignB", "clientB"],
    ] as const) {
      const { data, error } = await adminDb
        .from("campaigns")
        .insert({
          title: `Support ${campaignKey} ${ts}`,
          slug: testSlug(campaignKey),
          client_id: ids[clientKey],
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw new Error(`campaign insert: ${error.message}`);
      ids[campaignKey] = data!.id;
    }

    for (const [participantKey, campaignKey] of [
      ["participantA", "campaignA"],
      ["participantB", "campaignB"],
    ] as const) {
      const { data, error } = await adminDb
        .from("campaign_participants")
        .insert({
          campaign_id: ids[campaignKey],
          email: `${participantKey}-${ts}@test.local`,
          first_name: "Support",
          last_name: participantKey,
          status: "invited",
        })
        .select("id")
        .single();
      if (error) throw new Error(`participant insert: ${error.message}`);
      ids[participantKey] = data!.id;
    }

    const admin = await createTestUser(adminDb, {
      email: testEmail("admin"),
      role: "platform_admin",
    });
    platformAdminDb = admin.client;
    platformAdminId = admin.userId;
    authUserIds.push(admin.userId);

    // An ordinary member of client A, to prove the change touches only admins.
    const member = await createTestUser(adminDb, {
      email: testEmail("member"),
      role: "org_admin",
      clientId: ids.clientA,
    });
    memberDb = member.client;
    authUserIds.push(member.userId);
    const { error: membershipError } = await adminDb.from("client_memberships").insert({
      profile_id: member.userId,
      client_id: ids.clientA,
      role: "member",
    });
    if (membershipError) throw new Error(membershipError.message);
  });

  afterAll(async () => {
    if (!canRun) return;

    const cleanups: Cleanup[] = [
      { table: "support_sessions", ids: supportSessionIds },
      { table: "campaign_participants", ids: [ids.participantA, ids.participantB] },
      { table: "campaigns", ids: [ids.campaignA, ids.campaignB] },
      { table: "clients", ids: [ids.clientA, ids.clientB] },
    ];
    for (const { table, ids: rowIds } of cleanups) {
      const present = rowIds.filter(Boolean);
      if (present.length > 0) {
        await adminDb.from(table).delete().in("id", present);
      }
    }
    for (const userId of authUserIds) {
      await adminDb.auth.admin.deleteUser(userId);
    }
  });

  it("sees every client with no session open", async () => {
    expect(await visibleClientIds(platformAdminDb)).toEqual(
      [ids.clientA, ids.clientB].sort(),
    );
  });

  it("narrows to the session's client, and stops seeing the other", async () => {
    const sessionId = await openSupportSession(ids.clientA);
    try {
      // Both directions matter: confinement that also blinded support would be
      // useless, and confinement that left the other tenant visible would be
      // the bug this migration exists to close.
      expect(await visibleClientIds(platformAdminDb)).toEqual([ids.clientA]);
      expect(await visibleParticipantIds(platformAdminDb)).toEqual([
        ids.participantA,
      ]);
    } finally {
      await endSupportSession(sessionId);
    }
  });

  it("restores full visibility once the session ends", async () => {
    const sessionId = await openSupportSession(ids.clientA);
    expect(await visibleClientIds(platformAdminDb)).toEqual([ids.clientA]);

    await endSupportSession(sessionId);

    expect(await visibleClientIds(platformAdminDb)).toEqual(
      [ids.clientA, ids.clientB].sort(),
    );
  });

  it("ignores an expired session", async () => {
    // Otherwise an admin whose session was never explicitly ended would be
    // confined to that tenant indefinitely.
    await openSupportSession(
      ids.clientB,
      new Date(Date.now() - 60 * 1000).toISOString(),
    );

    expect(await visibleClientIds(platformAdminDb)).toEqual(
      [ids.clientA, ids.clientB].sort(),
    );
  });

  it("leaves an ordinary client member unchanged", async () => {
    // The member only ever saw their own client; a session against that same
    // client must not widen or narrow them.
    expect(await visibleClientIds(memberDb)).toEqual([ids.clientA]);

    const sessionId = await openSupportSession(ids.clientA);
    try {
      expect(await visibleClientIds(memberDb)).toEqual([ids.clientA]);
      expect(await visibleParticipantIds(memberDb)).toEqual([ids.participantA]);
    } finally {
      await endSupportSession(sessionId);
    }
  });

  it("keeps writes working inside a session", async () => {
    // is_platform_admin() is deliberately untouched, so an admin can still act
    // on the tenant they came to help. If this ever fails, the migration has
    // narrowed more than it intended.
    //
    // Asserting `error === null` would prove nothing: an UPDATE that RLS
    // refuses comes back from PostgREST as a SUCCESS affecting zero rows, not
    // as an error. So read the row back through the admin client — which
    // bypasses RLS and therefore reports what was actually written — and check
    // the value changed.
    const sessionId = await openSupportSession(ids.clientA);
    try {
      const { error } = await platformAdminDb
        .from("campaign_participants")
        .update({ first_name: "SupportEdited" })
        .eq("id", ids.participantA);
      expect(error).toBeNull();

      const { data: after } = await adminDb
        .from("campaign_participants")
        .select("first_name")
        .eq("id", ids.participantA)
        .single();
      expect(after?.first_name).toBe("SupportEdited");
    } finally {
      await endSupportSession(sessionId);
    }
  });
});
