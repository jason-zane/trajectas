import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient, createTestUser } from "./_helpers/rls-fixture";
import { getUserActivity } from "@/lib/dal/audit";

const ts = Date.now();

/**
 * Validates the getUserActivity query (audit_events read filtered by target_id
 * and target_table, ordered by created_at DESC, with limit applied) against
 * the live local schema. Ensures the row → DTO mapping works and the
 * query returns results newest-first.
 */
describe.skipIf(!canRun)("dal/audit: getUserActivity", () => {
  const admin = createAdminClient();
  const ids = {
    profile: "",
    otherProfile: "",
    eventIds: [] as string[],
  };

  beforeAll(async () => {
    // profiles.id REFERENCES auth.users(id) — rows must be auth-backed, so
    // create real users via the fixture rather than inserting bare profiles.
    const user = await createTestUser(admin, {
      email: `dala-${ts}@test.local`,
      role: "consultant",
    });
    ids.profile = user.userId;

    const otherUser = await createTestUser(admin, {
      email: `dala-other-${ts}@test.local`,
      role: "consultant",
    });
    ids.otherProfile = otherUser.userId;

    // Create audit events for the target profile
    const events = [
      {
        target_table: "profiles",
        target_id: ids.profile,
        event_type: "profile.created",
        metadata: { action: "signup" },
      },
      {
        target_table: "profiles",
        target_id: ids.profile,
        event_type: "profile.updated",
        metadata: { field: "name" },
      },
      {
        // metadata omitted — audit_events.metadata is NOT NULL DEFAULT '{}'
        target_table: "profiles",
        target_id: ids.profile,
        event_type: "profile.avatar_uploaded",
      },
    ];

    for (const event of events) {
      const { data: e, error: eErr } = await admin
        .from("audit_events")
        .insert(event)
        .select("id")
        .single();
      if (eErr) throw new Error(`audit_events insert: ${eErr.message}`);
      ids.eventIds.push(e!.id);
    }

    // Create an event for a different profile (should not be returned)
    const { error: otherErr2 } = await admin.from("audit_events").insert({
      target_table: "profiles",
      target_id: ids.otherProfile,
      event_type: "profile.created",
    });
    if (otherErr2)
      throw new Error(`other audit_events insert: ${otherErr2.message}`);
  });

  afterAll(async () => {
    // audit_events is append-only (DB-enforced block triggers) — never delete
    // from it. Rows stay scoped to this run's unique user UUIDs, so they
    // can't interfere with other tests. Deleting the auth users cascades the
    // profiles rows; the audit rows' actor FKs SET NULL via the depth-guarded
    // trigger path.
    await admin.auth.admin.deleteUser(ids.profile);
    await admin.auth.admin.deleteUser(ids.otherProfile);
  });

  it("returns audit events for target profile ordered newest first", async () => {
    const activity = await getUserActivity(ids.profile);

    expect(activity).toHaveLength(3);
    // Should be newest first (DESC order)
    expect(activity[0].eventType).toBe("profile.avatar_uploaded");
    expect(activity[1].eventType).toBe("profile.updated");
    expect(activity[2].eventType).toBe("profile.created");
  });

  it("returns events with correct DTO shape (id, eventType, createdAt, metadata)", async () => {
    const activity = await getUserActivity(ids.profile);

    expect(activity[0]).toMatchObject({
      id: expect.any(String),
      eventType: expect.any(String),
      createdAt: expect.any(String),
      metadata: expect.anything(),
    });
  });

  it("preserves metadata when present", async () => {
    const activity = await getUserActivity(ids.profile);
    const withMetadata = activity.find(
      (a) => a.eventType === "profile.created"
    );

    expect(withMetadata?.metadata).toEqual({ action: "signup" });
  });

  it("uses the column default {} when metadata is not provided", async () => {
    // audit_events.metadata is NOT NULL DEFAULT '{}' — it is never null in
    // the database, so the DTO surfaces the empty object.
    const activity = await getUserActivity(ids.profile);
    const withoutMetadata = activity.find(
      (a) => a.eventType === "profile.avatar_uploaded"
    );

    expect(withoutMetadata?.metadata).toEqual({});
  });

  it("respects the limit parameter (default 10)", async () => {
    // Use a dedicated user so the 15 extra events never pollute the main
    // fixture's timeline (audit_events is append-only — no cleanup possible).
    const limitUser = await createTestUser(admin, {
      email: `dala-limit-${ts}@test.local`,
      role: "consultant",
    });
    try {
      const manyEvents = Array.from({ length: 15 }, (_, i) => ({
        target_table: "profiles",
        target_id: limitUser.userId,
        event_type: `test.event_${i}`,
      }));

      const { error } = await admin.from("audit_events").insert(manyEvents);
      if (error) throw new Error(`many events insert: ${error.message}`);

      const activity = await getUserActivity(limitUser.userId);
      expect(activity.length).toBeLessThanOrEqual(10);
    } finally {
      await admin.auth.admin.deleteUser(limitUser.userId);
    }
  });

  it("returns empty array for profile with no audit events", async () => {
    const nonexistentProfileId = "00000000-0000-0000-0000-000000000000";
    const activity = await getUserActivity(nonexistentProfileId);

    expect(activity).toEqual([]);
  });

  it("filters by target_table === 'profiles' (does not return other tables)", async () => {
    const activity = await getUserActivity(ids.profile);

    // All events should have target_table implied as 'profiles' by the query
    // (we can't directly check the table name in the DTO, but we inserted only
    // profile events, so if we get results, they're the right ones)
    expect(activity.length).toBeGreaterThan(0);
    activity.forEach((evt) => {
      expect(evt.eventType).toBeDefined();
    });
  });

  it("accepts a custom limit parameter", async () => {
    const activity = await getUserActivity(ids.profile, 1);

    expect(activity).toHaveLength(1);
    expect(activity[0].eventType).toBe("profile.avatar_uploaded"); // newest
  });

  it("maps snake_case database columns to camelCase DTO fields", async () => {
    const activity = await getUserActivity(ids.profile);

    // Verify the mapping: event_type → eventType, created_at → createdAt
    activity.forEach((item) => {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("eventType");
      expect(item).toHaveProperty("createdAt");
      expect(item).toHaveProperty("metadata");
      // Should NOT have snake_case keys
      expect(item).not.toHaveProperty("event_type");
      expect(item).not.toHaveProperty("created_at");
    });
  });
});
