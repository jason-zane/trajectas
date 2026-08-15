/**
 * Item bank admin — ingest round trip and key isolation (LR-8 / #347).
 *
 * Covers what the pure unit tests (tests/unit/item-bank-ingest.test.ts) and
 * the psql harness (scripts/cognitive/ingest-roundtrip.ts) cannot: the
 * PostgREST path. `createSupabaseItemBankStore` is the production store, and
 * PostgREST's request shaping, embedded-resource selects and error mapping
 * are exactly the layer neither of the other two exercises.
 *
 * Requires a running local Supabase instance — see
 * tests/integration/_helpers/rls-fixture.ts and
 * tests/architecture/integration-host-guard.test.ts. Run with
 * `npm run test:integration:local`. `.env.local` points at PRODUCTION, so the
 * `canRun` host whitelist below is what keeps `npm run test:integration` from
 * writing a bank into the live bank.
 *
 * Fixtures are the hand-pinned LR-4 exemplars, not generator output: this
 * suite must not depend on any family's behaviour.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  canRun,
  createAdminClient,
  createTestUser,
} from "./_helpers/rls-fixture";
import { m1ItemSpec, m1OptionSpecs } from "../fixtures/cognitive/m1";
import { m6ItemSpec, m6OptionSpecs } from "../fixtures/cognitive/m6";
import { contentHash } from "@/lib/cognitive/spec/hash";
import { parseBankFile } from "@/lib/item-bank/bank-file";
import { ingestGeneratedBank, BankIngestConflictError } from "@/lib/item-bank/ingest";
import { createSupabaseItemBankStore } from "@/lib/item-bank/store";
import { getItemForReview } from "@/lib/dal/item-bank-review";
import {
  getItemBankOverview,
  listGenerationRuns,
  listItemFamilies,
  listFamilyItems,
} from "@/lib/dal/item-bank-admin";

const ts = Date.now();
const FAMILY_A = `IBA-PROG-${ts}`;
const FAMILY_B = `IBA-LATIN-${ts}`;
const SEED = `iba-${ts}`;

function bankEntry(
  itemSpec: unknown,
  optionSpecs: ReadonlyArray<{ slot: string; elements: unknown }>,
  familyCode: string,
  index: number,
  keySlot: string,
  labelledSlot?: string,
) {
  return {
    familyCode,
    seed: `${SEED}/${familyCode}/${index}`,
    keySlot,
    itemSpec,
    optionSpecs: optionSpecs.map((o) => ({
      slot: o.slot,
      elements: o.elements,
      ...(o.slot === labelledSlot ? { errorLabel: "WR", rationale: `wrong rule ${ts}` } : {}),
    })),
    qa: {
      generatorVersion: "0.1.0",
      batteryVersion: "0.1.0",
      passedAt: new Date().toISOString(),
      gates: { "G-01": { status: "pass" }, "G-13": { status: "pass" } },
      predictedB: 0.42,
      band: "moderate",
      contentHash: contentHash(itemSpec),
      structuralHash: `sha256:struct-${familyCode}-${index}`,
    },
  };
}

const summaryJson = {
  generatorVersion: "0.1.0",
  batteryVersion: "0.1.0",
  seed: SEED,
  perFamilyRequested: 1,
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  totalAttempted: 4,
  totalAccepted: 2,
  perFamily: {
    [FAMILY_A]: { attempted: 2, accepted: 1, rejects: { "G-08": 1 } },
    [FAMILY_B]: { attempted: 2, accepted: 1, rejects: {} },
  },
  bandDistribution: { easy: 0, moderate: 2, hard: 0, very_hard: 0 },
};

describe.skipIf(!canRun)("item bank admin", () => {
  const adminDb = createAdminClient();
  const store = createSupabaseItemBankStore(adminDb);

  const ids = {
    partner: "",
    construct: "",
    responseFormat: "",
    reviewer: "",
    fairnessReviewer: "",
    familyA: "",
    itemA: "",
  };
  const authUserIds: string[] = [];
  let anon: SupabaseClient;
  let platformAdminDb: SupabaseClient;

  async function insertRow(table: string, row: Record<string, unknown>): Promise<string> {
    const { data, error } = await adminDb.from(table).insert(row).select("id").single();
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
    return data!.id as string;
  }

  function bank(labelled = true) {
    return parseBankFile(
      JSON.parse(
        JSON.stringify([
          bankEntry(m1ItemSpec, m1OptionSpecs, FAMILY_A, 0, "B", labelled ? "A" : undefined),
          bankEntry(m6ItemSpec, m6OptionSpecs, FAMILY_B, 0, "A"),
        ]),
      ),
      JSON.parse(JSON.stringify(summaryJson)),
    );
  }

  beforeAll(async () => {
    if (!canRun) return;
    anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

    ids.partner = await insertRow("partners", { name: `IBA Partner ${ts}`, slug: `iba-partner-${ts}` });
    ids.construct = await insertRow("constructs", {
      name: `IBA Reasoning ${ts}`,
      slug: `iba-reasoning-${ts}`,
      partner_id: ids.partner,
    });
    ids.responseFormat = await insertRow("response_formats", {
      name: `IBA Cognitive ${ts}`,
      type: "cognitive",
      config: {},
    });

    const reviewer = await createTestUser(adminDb, {
      email: `iba-content-${ts}@example.com`,
      role: "platform_admin",
    });
    ids.reviewer = reviewer.userId;
    platformAdminDb = reviewer.client;
    authUserIds.push(reviewer.userId);

    const fairness = await createTestUser(adminDb, {
      email: `iba-fairness-${ts}@example.com`,
      role: "platform_admin",
    });
    ids.fairnessReviewer = fairness.userId;
    authUserIds.push(fairness.userId);
  });

  afterAll(async () => {
    if (!canRun) return;
    // items -> cascades to options, specs, keys, diagnostics and reviews.
    for (const code of [FAMILY_A, FAMILY_B]) {
      const { data: family } = await adminDb.from("item_families").select("id").eq("code", code).maybeSingle();
      if (!family) continue;
      await adminDb.from("item_families").update({ exemplar_item_id: null }).eq("id", family.id);
      await adminDb.from("items").delete().eq("family_id", family.id);
      await adminDb.from("item_families").delete().eq("id", family.id);
    }
    await adminDb.from("cognitive_generation_runs").delete().eq("seed", SEED);
    await adminDb.from("constructs").delete().eq("id", ids.construct);
    await adminDb.from("response_formats").delete().eq("id", ids.responseFormat);
    await adminDb.from("partners").delete().eq("id", ids.partner);
    for (const id of authUserIds) await adminDb.auth.admin.deleteUser(id).catch(() => undefined);
  });

  it("ingests a generated bank through the Supabase store", async () => {
    const result = await ingestGeneratedBank(store, {
      bank: bank(),
      constructId: ids.construct,
      responseFormatId: ids.responseFormat,
      requestedByProfileId: ids.reviewer,
    });

    expect(result.itemsInserted).toBe(2);
    expect(result.familiesCreated).toBe(2);
    expect(result.generationRunId).toBeTruthy();

    const families = await listItemFamilies(adminDb);
    const familyA = families.find((f) => f.code === FAMILY_A)!;
    expect(familyA.itemCount).toBe(1);
    expect(familyA.lifecycleCounts.draft).toBe(1);
    expect(familyA.difficultyPriorBandCounts.moderate).toBe(1);
    expect(familyA.exemplarItemId).toBeTruthy();
    ids.familyA = familyA.id;

    const items = await listFamilyItems(adminDb, familyA.id);
    expect(items).toHaveLength(1);
    expect(items[0].difficultyPriorB).toBeCloseTo(0.42);
    expect(items[0].generatorSeed).toBe(`${SEED}/${FAMILY_A}/0`);
    ids.itemA = items[0].id;
  });

  it("re-ingesting the identical bank writes nothing", async () => {
    const before = await getItemBankOverview(adminDb);
    const runsBefore = await listGenerationRuns(adminDb);

    const result = await ingestGeneratedBank(store, {
      bank: bank(),
      constructId: ids.construct,
      responseFormatId: ids.responseFormat,
      requestedByProfileId: ids.reviewer,
    });

    expect(result).toMatchObject({ generationRunId: null, itemsInserted: 0, itemsSkipped: 2, wroteAnything: false });

    const after = await getItemBankOverview(adminDb);
    expect(after.itemCount).toBe(before.itemCount);
    expect(after.familyCount).toBe(before.familyCount);
    // Not even a provenance row.
    expect((await listGenerationRuns(adminDb)).length).toBe(runsBefore.length);
  });

  it("refuses a changed item that reuses an existing (family, seed)", async () => {
    const mutated = bank();
    const victim = mutated.items[0];
    victim.itemSpec.rules[0].statement = `${victim.itemSpec.rules[0].statement} (edited)`;
    victim.qa.contentHash = contentHash(victim.itemSpec);

    const before = await getItemBankOverview(adminDb);
    await expect(
      ingestGeneratedBank(store, {
        bank: mutated,
        constructId: ids.construct,
        responseFormatId: ids.responseFormat,
        requestedByProfileId: ids.reviewer,
      }),
    ).rejects.toBeInstanceOf(BankIngestConflictError);

    const after = await getItemBankOverview(adminDb);
    expect(after.itemCount).toBe(before.itemCount);
  });

  it("surfaces the key and per-distractor labels on the admin review path", async () => {
    const review = await getItemForReview(adminDb, ids.itemA);
    expect(review).not.toBeNull();
    expect(review!.gridSvg).toContain("<svg");
    expect(review!.ruleStatements.length).toBeGreaterThan(0);
    expect(review!.difficultyPriorBand).toBe("moderate");

    const key = review!.options.find((o) => o.isKey)!;
    expect(key.slot).toBe("B");
    expect(review!.keyOptionId).toBe(key.optionId);

    const labelled = review!.options.find((o) => o.slot === "A")!;
    expect(labelled.errorLabel).toBe("WR");
    expect(labelled.errorRationale).toBe(`wrong rule ${ts}`);
  });

  it("keeps item_reviews unreachable by anon and by platform_admin over RLS", async () => {
    // The sign-off ledger is service-role only, like the rest of the bank's
    // secure set. No grant means a privilege ERROR, not an empty list.
    for (const [label, client] of [
      ["anon", anon],
      ["platform_admin", platformAdminDb],
    ] as const) {
      const { error } = await client.from("item_reviews").select("*").limit(1);
      expect(error, `${label} unexpectedly reached item_reviews`).toBeTruthy();
    }
    const { error } = await adminDb.from("item_reviews").select("*").limit(1);
    expect(error).toBeNull();
  });

  it("blocks promotion until both sign-offs exist, then allows it", async () => {
    const promote = (state: string) =>
      adminDb.from("items").update({ lifecycle_state: state }).eq("id", ids.itemA);

    const noContent = await promote("content_reviewed");
    expect(noContent.error?.message).toMatch(/no content review/);

    const contentReview = await adminDb.from("item_reviews").insert({
      item_id: ids.itemA,
      review_kind: "content",
      decision: "approved",
      reviewer_profile_id: ids.reviewer,
    });
    expect(contentReview.error).toBeNull();
    expect((await promote("content_reviewed")).error).toBeNull();

    const noFairness = await promote("fairness_reviewed");
    expect(noFairness.error?.message).toMatch(/no fairness review/);

    // A DIFFERENT actor signs off on fairness — the two judgements are
    // recorded separately, with their own actor and timestamp.
    const fairnessReview = await adminDb.from("item_reviews").insert({
      item_id: ids.itemA,
      review_kind: "fairness",
      decision: "approved",
      reviewer_profile_id: ids.fairnessReviewer,
    });
    expect(fairnessReview.error).toBeNull();
    expect((await promote("fairness_reviewed")).error).toBeNull();

    const review = await getItemForReview(adminDb, ids.itemA);
    expect(review!.contentSignOff?.reviewerProfileId).toBe(ids.reviewer);
    expect(review!.fairnessSignOff?.reviewerProfileId).toBe(ids.fairnessReviewer);
    expect(review!.contentSignOff?.matchesCurrentContent).toBe(true);
    expect(review!.contentSignOff?.reviewedAt).toBeTruthy();
    expect(review!.fairnessSignOff?.reviewedAt).toBeTruthy();
    expect(review!.reviewHistory).toHaveLength(2);
  });

  it("reports the generation run with its seed, version and QA tallies", async () => {
    const runs = await listGenerationRuns(adminDb);
    const run = runs.find((r) => r.seed === SEED)!;
    expect(run.status).toBe("succeeded");
    expect(run.generatorVersion).toBe("0.1.0");
    expect(run.ingestedItemCount).toBe(2);
    expect(run.qaGateTallies["G-01"]).toEqual({ pass: 2, fail: 0, skip: 0 });
    expect(run.rejectionReasons["G-08"]).toBe(1);
  });

  it("reads the lifecycle transition graph from the database, not from TypeScript", async () => {
    const { data, error } = await adminDb.rpc("item_lifecycle_legal_transitions");
    expect(error).toBeNull();
    const pairs = (data ?? []) as Array<{ from_state: string; to_state: string }>;
    expect(pairs.length).toBeGreaterThan(10);
    expect(pairs).toContainEqual({ from_state: "draft", to_state: "content_reviewed" });
    expect(pairs).not.toContainEqual({ from_state: "draft", to_state: "operational" });
  });
});
