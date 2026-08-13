import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  canRun,
  createAdminClient,
  createTestUser,
} from "./_helpers/rls-fixture";

/**
 * Answer-key isolation for the cognitive item bank (LR-1, #331).
 *
 * Cognitive items are scored against a key, so a leak hands candidates the
 * answers. 20260813100500 and 20260813101000 put every piece of key material
 * behind service_role and withhold `item_options.score_value` from the
 * anon/authenticated column grant.
 *
 * These assertions target the GRANT layer rather than RLS, and the distinction
 * matters for reading the results:
 *
 *   - No table privilege  -> PostgREST returns an ERROR (SQLSTATE 42501).
 *   - Privilege but RLS filters -> returns an empty array, no error.
 *
 * Everything below expects the first case, which is why no fixture rows are
 * seeded: an empty result would be a weaker assertion, and would still pass if
 * someone later restored the grant and relied on RLS alone. Errors prove the
 * privilege itself is gone.
 *
 * platform_admin is used deliberately as the authenticated probe. It is the
 * most privileged non-service role in the product, so if it cannot reach key
 * material, no dashboard user can.
 */

/** Tables that must be unreachable by anon and by any authenticated role. */
const SECURE_TABLES = [
  "item_answer_keys",
  // Key-revealing by omission: every distractor carries an error label, so the
  // option WITHOUT one is the key.
  "item_option_diagnostics",
  "cognitive_item_specs",
  "cognitive_option_specs",
  "item_families",
  "cognitive_generation_runs",
] as const;

describe.skipIf(!canRun)("cognitive answer-key isolation", () => {
  const admin = createAdminClient();
  let anon: SupabaseClient;
  let platformAdminDb: SupabaseClient;
  const authUserIds: string[] = [];

  beforeAll(async () => {
    anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

    const platformAdmin = await createTestUser(admin, {
      email: `cki-platform-admin-${Date.now()}@example.com`,
      role: "platform_admin",
    });
    platformAdminDb = platformAdmin.client;
    authUserIds.push(platformAdmin.userId);
  });

  afterAll(async () => {
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  describe("secure tables reject anon", () => {
    for (const table of SECURE_TABLES) {
      it(`anon cannot read ${table}`, async () => {
        const { error } = await anon.from(table).select("*").limit(1);
        expect(error, `anon unexpectedly reached ${table}`).toBeTruthy();
      });
    }
  });

  describe("secure tables reject authenticated (platform_admin)", () => {
    for (const table of SECURE_TABLES) {
      it(`platform admin cannot read ${table}`, async () => {
        const { error } = await platformAdminDb.from(table).select("*").limit(1);
        expect(
          error,
          `platform_admin unexpectedly reached ${table} — key material must be service-role only`,
        ).toBeTruthy();
      });
    }
  });

  describe("service_role retains access", () => {
    for (const table of SECURE_TABLES) {
      it(`service role can read ${table}`, async () => {
        // Empty is fine; the point is that no privilege error is raised, so the
        // server-side scoring and generation paths still work.
        const { error } = await admin.from(table).select("*").limit(1);
        expect(error, `service_role lost access to ${table}`).toBeNull();
      });
    }
  });

  describe("item_options.score_value column grant", () => {
    it("anon cannot select score_value", async () => {
      const { error } = await anon
        .from("item_options")
        .select("score_value")
        .limit(1);
      expect(error).toBeTruthy();
    });

    it("platform admin cannot select score_value", async () => {
      const { error } = await platformAdminDb
        .from("item_options")
        .select("score_value")
        .limit(1);
      expect(error).toBeTruthy();
    });

    it("platform admin can still select the non-key columns", async () => {
      // The hardening is a table-level REVOKE plus a column-level GRANT of the
      // safe columns, so the rest of item_options must remain readable —
      // otherwise the admin item editor breaks.
      const { error } = await platformAdminDb
        .from("item_options")
        .select("id, item_id, label, value, display_order, exclude_from_scoring")
        .limit(1);
      expect(error).toBeNull();
    });

    it("service role can still select score_value", async () => {
      // ctt-session.ts and the admin item editor read this column via the
      // service-role client.
      const { error } = await admin
        .from("item_options")
        .select("score_value")
        .limit(1);
      expect(error).toBeNull();
    });
  });

  describe("previously anon-readable item tables", () => {
    // 00005_foundation_alignment.sql created these with
    // `FOR SELECT USING (true)` and no TO clause, which PostgreSQL applies to
    // every role including anon. 20260813101000 restricts them to authenticated.
    it("anon cannot read item_media", async () => {
      const { data, error } = await anon.from("item_media").select("id").limit(1);
      // RLS-filtered rather than privilege-denied, so an empty result is the
      // expected outcome here, not an error.
      expect(error ? true : (data ?? []).length === 0).toBe(true);
    });

    it("anon cannot read item_scoring_rubrics", async () => {
      const { data, error } = await anon
        .from("item_scoring_rubrics")
        .select("id")
        .limit(1);
      expect(error ? true : (data ?? []).length === 0).toBe(true);
    });
  });
});
