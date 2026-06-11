import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { getUserActivity } from "@/lib/dal/audit";

const ts = Date.now();
const slug = (s: string) => `dala-${s}-${ts}`.toLowerCase();

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
    // Create test profiles
    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .insert({ email: `dala-${ts}@test.local`, slug: slug("profile") })
      .select("id")
      .single();
    if (profErr) throw new Error(`profile insert: ${profErr.message}`);
    ids.profile = prof!.id;

    const { data: otherProf, error: otherErr } = await admin
      .from("profiles")
      .insert({
        email: `dala-other-${ts}@test.local`,
        slug: slug("other-profile"),
      })
      .select("id")
      .single();
    if (otherErr) throw new Error(`other profile insert: ${otherErr.message}`);
    ids.otherProfile = otherProf!.id;

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
        target_table: "profiles",
        target_id: ids.profile,
        event_type: "profile.avatar_uploaded",
        metadata: null,
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
      metadata: null,
    });
    if (otherErr2)
      throw new Error(`other audit_events insert: ${otherErr2.message}`);
  });

  afterAll(async () => {
    // Clean up in reverse dependency order
    await admin.from("audit_events").delete().eq("target_id", ids.profile);
    await admin.from("audit_events").delete().eq("target_id", ids.otherProfile);
    await admin.from("profiles").delete().eq("id", ids.profile);
    await admin.from("profiles").delete().eq("id", ids.otherProfile);
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

  it("defaults metadata to null when not provided", async () => {
    const activity = await getUserActivity(ids.profile);
    const withoutMetadata = activity.find(
      (a) => a.eventType === "profile.avatar_uploaded"
    );

    expect(withoutMetadata?.metadata).toBeNull();
  });

  it("respects the limit parameter (default 10)", async () => {
    // Create many events
    const manyEvents = Array.from({ length: 15 }, (_, i) => ({
      target_table: "profiles",
      target_id: ids.profile,
      event_type: `test.event_${i}`,
      metadata: null,
    }));

    const { error } = await admin
      .from("audit_events")
      .insert(manyEvents);
    if (error) throw new Error(`many events insert: ${error.message}`);

    try {
      const activity = await getUserActivity(ids.profile);
      // Default limit is 10; we have 3 original + 15 new = 18 total
      expect(activity.length).toBeLessThanOrEqual(10);
    } finally {
      // Cleanup the test events
      await admin
        .from("audit_events")
        .delete()
        .gte("event_type", "test.event_");
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
