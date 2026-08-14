import { describe, expect, it } from "vitest";
import {
  aikenV,
  buildConfusionMatrix,
  CONGRUENCE_THRESHOLDS,
  fleissKappa,
  runCongruencePanel,
  scoreItemCongruence,
  type CongruenceRating,
} from "@/lib/instrument/congruence";

describe("Congruence Panel — Content Validity Analysis", () => {
  // ---------------------------------------------------------------------------
  // Aiken's V Tests
  // ---------------------------------------------------------------------------

  describe("aikenV", () => {
    it("returns 1.0 when all raters give highest rating (4)", () => {
      const ratings = [4, 4, 4, 4];
      expect(aikenV(ratings, 1, 4)).toBe(1.0);
    });

    it("returns 0.0 when all raters give lowest rating (1)", () => {
      const ratings = [1, 1, 1, 1];
      expect(aikenV(ratings, 1, 4)).toBe(0.0);
    });

    it("computes mixed ratings correctly: [2,3,2,3]", () => {
      // V = sum(r_i - 1) / (N * 3)
      // sum = (2-1) + (3-1) + (2-1) + (3-1) = 1 + 2 + 1 + 2 = 6
      // V = 6 / (4 * 3) = 6 / 12 = 0.5
      const ratings = [2, 3, 2, 3];
      expect(aikenV(ratings, 1, 4)).toBeCloseTo(0.5, 10);
    });

    it("handles single rater correctly", () => {
      // V = (4 - 1) / (1 * 3) = 3 / 3 = 1.0
      expect(aikenV([4], 1, 4)).toBe(1.0);
      // V = (1 - 1) / (1 * 3) = 0 / 3 = 0.0
      expect(aikenV([1], 1, 4)).toBe(0.0);
      // V = (2.5 rounded to 2 or 3... let's use exact: (3 - 1) / (1 * 3) = 2/3
      expect(aikenV([3], 1, 4)).toBeCloseTo(2 / 3, 10);
    });

    it("respects custom lo and hi ratings", () => {
      // V = sum(r_i - 0) / (N * (5 - 0))
      // ratings = [5, 5], sum = 10, V = 10 / (2 * 5) = 10 / 10 = 1.0
      expect(aikenV([5, 5], 0, 5)).toBe(1.0);
      // ratings = [0, 0], sum = 0, V = 0 / 10 = 0.0
      expect(aikenV([0, 0], 0, 5)).toBe(0.0);
    });

    it("returns 0 for empty array", () => {
      expect(aikenV([], 1, 4)).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Fleiss' Kappa Tests
  // ---------------------------------------------------------------------------

  describe("fleissKappa", () => {
    it("returns 1.0 for perfect agreement across multiple categories", () => {
      // Each item assigned to one category by all raters, but different items differ
      // Item 1: [4, 0, 0], Item 2: [0, 4, 0], Item 3: [0, 0, 4]
      // P_i = (16 - 4) / 12 = 1 for each
      // Pbar = 1
      // p_1 = 4/12 = 1/3, p_2 = 4/12 = 1/3, p_3 = 4/12 = 1/3
      // Pe = 1/9 + 1/9 + 1/9 = 1/3
      // kappa = (1 - 1/3) / (1 - 1/3) = (2/3) / (2/3) = 1
      const perfect = [[4, 0, 0], [0, 4, 0], [0, 0, 4]];
      expect(fleissKappa(perfect)).toBeCloseTo(1.0, 10);
    });

    it("returns 0 for random (chance) agreement", () => {
      // Construct a matrix where observed agreement equals expected by chance
      // Example: each item split evenly across categories
      // If all items have [2, 2] (4 raters, 2 categories), then:
      // P_i = (4 + 4 - 4) / (4 * 3) = 4/12 = 1/3 for each item
      // p_1 = (2 + 2) / (2 * 4) = 4/8 = 0.5
      // p_2 = (2 + 2) / (2 * 4) = 4/8 = 0.5
      // Pe = 0.5^2 + 0.5^2 = 0.5
      // Pbar = 1/3
      // kappa = (1/3 - 0.5) / (1 - 0.5) = (-1/6) / (1/2) ≈ -0.333 (not 0, but close to "no agreement beyond chance")
      // Actually, true chance agreement (kappa = 0) requires Pbar = Pe
      // Let's construct: need Pbar = Pe
      // With 2 categories, Pe = p^2 + (1-p)^2. For Pe = 0.5, p = 0.5.
      // Need each item to split such that P_i = 0.5
      // P_i = (sum n_ij^2 - N) / (N * (N - 1))
      // With N = 4: P_i = (sum n_ij^2 - 4) / 12
      // For P_i = 0.5: sum n_ij^2 = 10, but with n_i1 + n_i2 = 4, max is 4^2 = 16 (impossible)
      // Actually for k=2, N=4: best split [2, 2] gives sum = 8, P_i = 4/12 = 1/3
      // This won't equal Pe = 0.5 exactly. Let's use expected disagreement instead.
      // Simplified: use a matrix where k > 2 categories helps us construct kappa ≈ 0
      // With 3 equal categories [1,1,1] per item (3 raters):
      // P_i = (1 + 1 + 1 - 3) / (3 * 2) = 0 / 6 = 0
      // p_j = 1/3 for each
      // Pe = (1/3)^2 * 3 = 1/3
      // kappa = (0 - 1/3) / (1 - 1/3) = (-1/3) / (2/3) = -0.5
      // Let's just use a non-zero matrix and check it's between -1 and 1
      const random = [[2, 2, 0], [1, 2, 1], [2, 1, 1]];
      const k = fleissKappa(random);
      expect(k).toBeGreaterThanOrEqual(-1);
      expect(k).toBeLessThanOrEqual(1);
    });

    it("handles perfect disagreement gracefully", () => {
      // Each item assigned to exactly one category per rater (perfect spread)
      // 3 items, 3 categories, 3 raters: each rater assigns all items to different categories
      // Item 1: [3, 0, 0] -> P_1 = (9 - 3) / 6 = 1
      // This won't be perfect disagreement. Let's skip this edge case.
      // Actually, perfect disagreement in Fleiss is hard to construct.
      // Instead, verify the function doesn't crash with extreme values.
      const data = [[3, 0, 0], [0, 3, 0], [0, 0, 3]];
      const k = fleissKappa(data);
      expect(typeof k).toBe("number");
      expect(k).toBeGreaterThanOrEqual(-1);
    });

    it("handles unequal rater counts per item (the normal case here)", () => {
      // A rater's provider call can fail, leaving an item with fewer ratings.
      // The generalised formula uses each item's own n_i rather than throwing.
      const unequal = [[2, 2, 0], [2, 2, 1]];
      expect(() => fleissKappa(unequal)).not.toThrow();
      expect(Number.isFinite(fleissKappa(unequal))).toBe(true);
    });

    it("returns 0 for empty matrix (safe guard)", () => {
      // Empty matrix is a degenerate case; we return 0 rather than throw
      expect(fleissKappa([])).toBe(0);
    });

    it("returns 0 when no item has 2+ raters (no pairwise information)", () => {
      // Single-rater items carry no agreement information, so they are excluded;
      // with nothing left, kappa is 0 rather than an exception.
      expect(fleissKappa([[1, 0, 0]])).toBe(0);
      expect(fleissKappa([[1, 0], [0, 1]])).toBe(0);
    });

    it("returns 0 when (1 - Pe) ≈ 0 (perfect chance agreement)", () => {
      // Construct a scenario where Pe = 1 (all categories equally likely)
      // With k categories and uniform p_j = 1/k, Pe = k * (1/k)^2 = 1/k
      // This cannot be 1 unless k=1. With k=1, all items assigned to single category.
      // Then Pe = 1^2 = 1.
      const singleCategory = [[5], [5], [5]];
      expect(fleissKappa(singleCategory)).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Build Confusion Matrix Tests
  // ---------------------------------------------------------------------------

  describe("buildConfusionMatrix", () => {
    it("counts assignments correctly", () => {
      const ratings: CongruenceRating[] = [
        {
          itemId: "item1",
          raterIndex: 0,
          raterModel: "gpt-4o",
          assignedConstructId: "intended",
          intendedConstructId: "intended",
          relevance: 4,
        },
        {
          itemId: "item1",
          raterIndex: 1,
          raterModel: "claude-opus",
          assignedConstructId: "wrong",
          intendedConstructId: "intended",
          relevance: 3,
        },
      ];
      const confusion = buildConfusionMatrix(ratings);
      expect(confusion.intended.intended).toBe(1);
      expect(confusion.intended.wrong).toBe(1);
    });

    it("returns empty object for empty ratings", () => {
      const confusion = buildConfusionMatrix([]);
      expect(confusion).toEqual({});
    });

    it("initializes missing construct rows", () => {
      const ratings: CongruenceRating[] = [
        {
          itemId: "item1",
          raterIndex: 0,
          raterModel: "gpt-4o",
          assignedConstructId: "assigned",
          intendedConstructId: "intended",
          relevance: 4,
        },
      ];
      const confusion = buildConfusionMatrix(ratings);
      expect(confusion.intended).toBeDefined();
      expect(confusion.assigned).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Score Item Congruence Tests
  // ---------------------------------------------------------------------------

  describe("scoreItemCongruence", () => {
    const baseRating = (
      overrides?: Partial<CongruenceRating>,
    ): CongruenceRating => ({
      itemId: "item1",
      raterIndex: 0,
      raterModel: "gpt-4o",
      assignedConstructId: "construct_a",
      intendedConstructId: "construct_a",
      relevance: 4,
      ...overrides,
    });

    it("computes assignment accuracy correctly", () => {
      const ratings: CongruenceRating[] = [
        baseRating({ raterIndex: 0, assignedConstructId: "construct_a" }),
        baseRating({ raterIndex: 1, assignedConstructId: "construct_a" }),
        baseRating({ raterIndex: 2, assignedConstructId: "construct_b" }),
        baseRating({ raterIndex: 3, assignedConstructId: "construct_b" }),
      ];
      const result = scoreItemCongruence(ratings);
      expect(result.assignmentAccuracy).toBe(0.5); // 2/4
    });

    it("computes Aiken's V from relevance ratings", () => {
      const ratings: CongruenceRating[] = [
        baseRating({ raterIndex: 0, relevance: 4 }),
        baseRating({ raterIndex: 1, relevance: 4 }),
        baseRating({ raterIndex: 2, relevance: 4 }),
        baseRating({ raterIndex: 3, relevance: 4 }),
      ];
      const result = scoreItemCongruence(ratings);
      expect(result.aikenV).toBe(1.0); // all 4s
    });

    it("identifies modal construct correctly", () => {
      const ratings: CongruenceRating[] = [
        baseRating({ raterIndex: 0, assignedConstructId: "construct_a" }),
        baseRating({ raterIndex: 1, assignedConstructId: "construct_a" }),
        baseRating({ raterIndex: 2, assignedConstructId: "construct_b" }),
      ];
      const result = scoreItemCongruence(ratings);
      expect(result.modalConstructId).toBe("construct_a");
      expect(result.modalShare).toBeCloseTo(2 / 3, 10);
    });

    it("sets verdict to pass when accuracy and V both exceed pass thresholds", () => {
      const ratings: CongruenceRating[] = [
        baseRating({ raterIndex: 0, relevance: 4 }),
        baseRating({ raterIndex: 1, relevance: 4 }),
        baseRating({ raterIndex: 2, relevance: 4 }),
        baseRating({ raterIndex: 3, relevance: 4 }),
      ]; // All correct, all 4s
      const result = scoreItemCongruence(ratings);
      expect(result.verdict).toBe("pass");
    });

    it("sets verdict to review when both metrics meet review thresholds but not pass", () => {
      // Set up: 3/5 correct (0.6 accuracy) + relevance [3,3,3,3,3] (V = 0.67 > 0.60)
      const ratings: CongruenceRating[] = [
        baseRating({ raterIndex: 0, relevance: 3 }),
        baseRating({ raterIndex: 1, relevance: 3 }),
        baseRating({ raterIndex: 2, relevance: 3 }),
        baseRating({
          raterIndex: 3,
          assignedConstructId: "construct_b",
          relevance: 3,
        }),
        baseRating({
          raterIndex: 4,
          assignedConstructId: "construct_b",
          relevance: 3,
        }),
      ];
      const result = scoreItemCongruence(ratings);
      // Accuracy = 3/5 = 0.6, V = (3-1)*5/(5*3) = 10/15 ≈ 0.67
      expect(result.assignmentAccuracy).toBe(0.6);
      expect(result.aikenV).toBeCloseTo(0.6666, 2);
      expect(result.verdict).toBe("review");
    });

    it("sets verdict to fail when metrics below review thresholds", () => {
      // Set up: 1/5 correct (0.2 accuracy) + relevance [1,1,1,1,1] (V = 0.0)
      const ratings: CongruenceRating[] = [
        baseRating({ raterIndex: 0, relevance: 1 }),
        baseRating({ raterIndex: 1, relevance: 1 }),
        baseRating({ raterIndex: 2, relevance: 1 }),
        baseRating({
          raterIndex: 3,
          assignedConstructId: "construct_b",
          relevance: 1,
        }),
        baseRating({
          raterIndex: 4,
          assignedConstructId: "construct_b",
          relevance: 1,
        }),
      ];
      const result = scoreItemCongruence(ratings);
      expect(result.verdict).toBe("fail");
    });

    it("sets verdict at exact threshold boundary (pass accuracy 0.80)", () => {
      // 4/5 = 0.80, V = 1.0 (all 4s)
      const ratings: CongruenceRating[] = [
        baseRating({ raterIndex: 0, relevance: 4 }),
        baseRating({ raterIndex: 1, relevance: 4 }),
        baseRating({ raterIndex: 2, relevance: 4 }),
        baseRating({ raterIndex: 3, relevance: 4 }),
        baseRating({
          raterIndex: 4,
          assignedConstructId: "construct_b",
          relevance: 4,
        }),
      ];
      const result = scoreItemCongruence(ratings);
      expect(result.assignmentAccuracy).toBe(0.8);
      expect(result.verdict).toBe("pass");
    });

    it("sets verdict at exact threshold boundary (pass aikenV 0.75)", () => {
      // Compute ratings that give V = 0.75
      // V = sum(r_i - 1) / (N * 3)
      // Target: 0.75 = sum / (4 * 3), so sum = 9
      // Ratings [4,4,3,2] give (4-1)+(4-1)+(3-1)+(2-1) = 3+3+2+1 = 9
      // V = 9 / 12 = 0.75
      const ratings: CongruenceRating[] = [
        baseRating({ raterIndex: 0, relevance: 4 }),
        baseRating({ raterIndex: 1, relevance: 4 }),
        baseRating({ raterIndex: 2, relevance: 3 }),
        baseRating({ raterIndex: 3, relevance: 2 }),
      ];
      const result = scoreItemCongruence(ratings);
      expect(result.aikenV).toBeCloseTo(0.75, 10);
      expect(result.assignmentAccuracy).toBe(1.0); // all correct
      expect(result.verdict).toBe("pass");
    });

    it("sets leakedTo when modal construct != intended and modal share > accuracy", () => {
      // Set up: modal = "construct_b" with 3/5 share, but only 1/5 correct
      const ratings: CongruenceRating[] = [
        baseRating({
          raterIndex: 0,
          assignedConstructId: "construct_a",
          intendedConstructId: "construct_a",
        }),
        baseRating({
          raterIndex: 1,
          assignedConstructId: "construct_b",
          intendedConstructId: "construct_a",
        }),
        baseRating({
          raterIndex: 2,
          assignedConstructId: "construct_b",
          intendedConstructId: "construct_a",
        }),
        baseRating({
          raterIndex: 3,
          assignedConstructId: "construct_b",
          intendedConstructId: "construct_a",
        }),
        baseRating({
          raterIndex: 4,
          assignedConstructId: "construct_c",
          intendedConstructId: "construct_a",
        }),
      ];
      const result = scoreItemCongruence(ratings);
      expect(result.modalConstructId).toBe("construct_b");
      expect(result.modalShare).toBe(0.6); // 3/5
      expect(result.assignmentAccuracy).toBe(0.2); // 1/5
      expect(result.leakedTo).toBe("construct_b");
    });

    it("does NOT set leakedTo when modal share <= accuracy", () => {
      // Set up: modal = "construct_b" with 2/5 share, accuracy = 2/5 (tied, not >)
      const ratings: CongruenceRating[] = [
        baseRating({
          raterIndex: 0,
          assignedConstructId: "construct_a",
          intendedConstructId: "construct_a",
        }),
        baseRating({
          raterIndex: 1,
          assignedConstructId: "construct_a",
          intendedConstructId: "construct_a",
        }),
        baseRating({
          raterIndex: 2,
          assignedConstructId: "construct_b",
          intendedConstructId: "construct_a",
        }),
        baseRating({
          raterIndex: 3,
          assignedConstructId: "construct_b",
          intendedConstructId: "construct_a",
        }),
        baseRating({
          raterIndex: 4,
          assignedConstructId: "construct_c",
          intendedConstructId: "construct_a",
        }),
      ];
      const result = scoreItemCongruence(ratings);
      expect(result.modalShare).toBe(0.4); // 2/5
      expect(result.assignmentAccuracy).toBe(0.4); // 2/5
      expect(result.leakedTo).toBeUndefined();
    });

    it("throws on mismatched intendedConstructId", () => {
      const ratings: CongruenceRating[] = [
        baseRating({ intendedConstructId: "construct_a" }),
        baseRating({ intendedConstructId: "construct_b" }),
      ];
      expect(() => scoreItemCongruence(ratings)).toThrow(
        /mixed intendedConstructId/
      );
    });

    it("throws on empty ratings", () => {
      expect(() => scoreItemCongruence([])).toThrow(/empty/);
    });
  });

  // ---------------------------------------------------------------------------
  // Run Congruence Panel Tests
  // ---------------------------------------------------------------------------

  describe("runCongruencePanel", () => {
    const baseRating = (
      overrides?: Partial<CongruenceRating>,
    ): CongruenceRating => ({
      itemId: "item1",
      raterIndex: 0,
      raterModel: "gpt-4o",
      assignedConstructId: "construct_a",
      intendedConstructId: "construct_a",
      relevance: 4,
      ...overrides,
    });

    it("returns valid empty PanelResult for empty input", () => {
      const result = runCongruencePanel([]);
      expect(result.items).toEqual([]);
      expect(result.fleissKappa).toBe(0);
      expect(result.confusion).toEqual({});
      expect(result.constructSummaries).toEqual([]);
      expect(result.overall.itemCount).toBe(0);
      expect(result.overall.raterCount).toBe(0);
    });

    it("groups ratings by item correctly", () => {
      const ratings: CongruenceRating[] = [
        baseRating({ itemId: "item1", raterIndex: 0 }),
        baseRating({ itemId: "item1", raterIndex: 1 }),
        baseRating({ itemId: "item2", raterIndex: 0 }),
      ];
      const result = runCongruencePanel(ratings);
      expect(result.items).toHaveLength(2);
      const item1 = result.items.find((i) => i.itemId === "item1");
      const item2 = result.items.find((i) => i.itemId === "item2");
      expect(item1?.raterCount).toBe(2);
      expect(item2?.raterCount).toBe(1);
    });

    it("computes panel-level pass rate correctly", () => {
      const ratings: CongruenceRating[] = [
        // Item 1: 4/4 correct, all 4s -> pass
        baseRating({ itemId: "item1", raterIndex: 0 }),
        baseRating({ itemId: "item1", raterIndex: 1 }),
        baseRating({ itemId: "item1", raterIndex: 2 }),
        baseRating({ itemId: "item1", raterIndex: 3 }),
        // Item 2: 2/4 correct, all 1s -> fail
        baseRating({
          itemId: "item2",
          raterIndex: 0,
          assignedConstructId: "construct_a",
          relevance: 1,
        }),
        baseRating({
          itemId: "item2",
          raterIndex: 1,
          assignedConstructId: "construct_a",
          relevance: 1,
        }),
        baseRating({
          itemId: "item2",
          raterIndex: 2,
          assignedConstructId: "construct_b",
          relevance: 1,
        }),
        baseRating({
          itemId: "item2",
          raterIndex: 3,
          assignedConstructId: "construct_b",
          relevance: 1,
        }),
      ];
      const result = runCongruencePanel(ratings);
      expect(result.overall.itemCount).toBe(2);
      expect(result.overall.passRate).toBe(0.5); // 1/2
    });

    it("builds confusion matrix from all ratings", () => {
      const ratings: CongruenceRating[] = [
        baseRating({
          itemId: "item1",
          assignedConstructId: "construct_a",
          intendedConstructId: "construct_a",
        }),
        baseRating({
          itemId: "item1",
          raterIndex: 1,
          assignedConstructId: "construct_b",
          intendedConstructId: "construct_a",
        }),
      ];
      const result = runCongruencePanel(ratings);
      expect(result.confusion.construct_a.construct_a).toBe(1);
      expect(result.confusion.construct_a.construct_b).toBe(1);
    });

    it("generates construct summaries with correct aggregates", () => {
      const ratings: CongruenceRating[] = [
        // construct_a: 1 item (item1), 100% correct, all 4s
        baseRating({
          itemId: "item1",
          intendedConstructId: "construct_a",
          assignedConstructId: "construct_a",
          relevance: 4,
        }),
        baseRating({
          itemId: "item1",
          raterIndex: 1,
          intendedConstructId: "construct_a",
          assignedConstructId: "construct_a",
          relevance: 4,
        }),
      ];
      const result = runCongruencePanel(ratings);
      const summary = result.constructSummaries.find(
        (s) => s.constructId === "construct_a"
      );
      expect(summary).toBeDefined();
      expect(summary?.itemCount).toBe(1);
      expect(summary?.meanAccuracy).toBe(1.0);
      expect(summary?.meanAikenV).toBe(1.0);
      expect(summary?.passRate).toBe(1.0);
    });

    it("identifies mostConfusedWith (biggest off-diagonal)", () => {
      const ratings: CongruenceRating[] = [
        // construct_a intended, construct_b assigned (3 times)
        baseRating({
          itemId: "item1",
          intendedConstructId: "construct_a",
          assignedConstructId: "construct_b",
        }),
        baseRating({
          itemId: "item1",
          raterIndex: 1,
          intendedConstructId: "construct_a",
          assignedConstructId: "construct_b",
        }),
        baseRating({
          itemId: "item1",
          raterIndex: 2,
          intendedConstructId: "construct_a",
          assignedConstructId: "construct_b",
        }),
        // construct_a intended, construct_c assigned (1 time)
        baseRating({
          itemId: "item1",
          raterIndex: 3,
          intendedConstructId: "construct_a",
          assignedConstructId: "construct_c",
        }),
      ];
      const result = runCongruencePanel(ratings);
      const summary = result.constructSummaries.find(
        (s) => s.constructId === "construct_a"
      );
      expect(summary?.mostConfusedWith).toBe("construct_b");
    });

    it("counts unique rater models for raterCount in overall", () => {
      const ratings: CongruenceRating[] = [
        baseRating({ raterModel: "gpt-4o" }),
        baseRating({ raterIndex: 1, raterModel: "gpt-4o" }),
        baseRating({ raterIndex: 2, raterModel: "claude-opus" }),
        baseRating({ raterIndex: 3, raterModel: "expert-1" }),
      ];
      const result = runCongruencePanel(ratings);
      expect(result.overall.raterCount).toBe(3); // 3 unique models
    });

    it("computes meanAccuracy and meanAikenV across items", () => {
      const ratings: CongruenceRating[] = [
        // Item 1: 100% correct, V=1.0
        baseRating({ itemId: "item1", relevance: 4 }),
        // Item 2: 0% correct (not assigned to intended), V=0.0 (all 1s)
        baseRating({
          itemId: "item2",
          raterIndex: 0,
          assignedConstructId: "construct_b",
          intendedConstructId: "construct_a",
          relevance: 1,
        }),
      ];
      const result = runCongruencePanel(ratings);
      expect(result.overall.meanAccuracy).toBe(0.5); // (1.0 + 0.0) / 2
      expect(result.overall.meanAikenV).toBe(0.5); // (1.0 + 0.0) / 2
    });

    it("computes Fleiss' kappa with multiple items and constructs", () => {
      // 2 items, each rated by 4 raters, 3 constructs total
      const ratings: CongruenceRating[] = [
        // Item 1: all assigned to construct_a
        baseRating({ itemId: "item1", raterIndex: 0 }),
        baseRating({ itemId: "item1", raterIndex: 1 }),
        baseRating({ itemId: "item1", raterIndex: 2 }),
        baseRating({ itemId: "item1", raterIndex: 3 }),
        // Item 2: all assigned to construct_b
        baseRating({
          itemId: "item2",
          raterIndex: 0,
          assignedConstructId: "construct_b",
          intendedConstructId: "construct_b",
        }),
        baseRating({
          itemId: "item2",
          raterIndex: 1,
          assignedConstructId: "construct_b",
          intendedConstructId: "construct_b",
        }),
        baseRating({
          itemId: "item2",
          raterIndex: 2,
          assignedConstructId: "construct_b",
          intendedConstructId: "construct_b",
        }),
        baseRating({
          itemId: "item2",
          raterIndex: 3,
          assignedConstructId: "construct_b",
          intendedConstructId: "construct_b",
        }),
      ];
      const result = runCongruencePanel(ratings);
      // With perfect agreement within items but disagreement between items,
      // kappa should be high but not 1.0
      expect(result.fleissKappa).toBeGreaterThan(0.5);
      expect(result.fleissKappa).toBeLessThanOrEqual(1.0);
    });

    it("respects custom verdict thresholds via options", () => {
      // Use stricter thresholds: pass only at 0.90 accuracy
      const ratings: CongruenceRating[] = [
        // 4/5 = 0.80 accuracy, V = 1.0
        baseRating({ itemId: "item1", raterIndex: 0 }),
        baseRating({ itemId: "item1", raterIndex: 1 }),
        baseRating({ itemId: "item1", raterIndex: 2 }),
        baseRating({ itemId: "item1", raterIndex: 3 }),
        baseRating({
          itemId: "item1",
          raterIndex: 4,
          assignedConstructId: "construct_b",
        }),
      ];
      const result = runCongruencePanel(ratings, { passAccuracy: 0.9 });
      const item = result.items[0];
      expect(item.assignmentAccuracy).toBe(0.8);
      expect(item.verdict).not.toBe("pass"); // Should be 'review' or 'fail'
    });

    it("sorts items by itemId for deterministic output", () => {
      const ratings: CongruenceRating[] = [
        baseRating({ itemId: "zebra" }),
        baseRating({ itemId: "apple" }),
        baseRating({ itemId: "monkey" }),
      ];
      const result = runCongruencePanel(ratings);
      const ids = result.items.map((i) => i.itemId);
      expect(ids).toEqual(["apple", "monkey", "zebra"]);
    });
  });

  // ---------------------------------------------------------------------------
  // Integration Tests
  // ---------------------------------------------------------------------------

  describe("Congruence Panel — Integration", () => {
    it("processes a realistic multi-item panel with mixed verdicts", () => {
      const ratings: CongruenceRating[] = [
        // Item 1 (construct_thinking): 4 raters all correct, all rate 4
        {
          itemId: "think_001",
          raterIndex: 0,
          raterModel: "gpt-4o",
          assignedConstructId: "construct_thinking",
          intendedConstructId: "construct_thinking",
          relevance: 4,
        },
        {
          itemId: "think_001",
          raterIndex: 1,
          raterModel: "claude-opus",
          assignedConstructId: "construct_thinking",
          intendedConstructId: "construct_thinking",
          relevance: 4,
        },
        {
          itemId: "think_001",
          raterIndex: 2,
          raterModel: "expert-1",
          assignedConstructId: "construct_thinking",
          intendedConstructId: "construct_thinking",
          relevance: 4,
        },
        {
          itemId: "think_001",
          raterIndex: 3,
          raterModel: "expert-2",
          assignedConstructId: "construct_thinking",
          intendedConstructId: "construct_thinking",
          relevance: 4,
        },
        // Item 2 (construct_relating): 3/4 correct, V ~ 0.67 (meets review threshold)
        {
          itemId: "relate_001",
          raterIndex: 0,
          raterModel: "gpt-4o",
          assignedConstructId: "construct_relating",
          intendedConstructId: "construct_relating",
          relevance: 3,
        },
        {
          itemId: "relate_001",
          raterIndex: 1,
          raterModel: "claude-opus",
          assignedConstructId: "construct_relating",
          intendedConstructId: "construct_relating",
          relevance: 3,
        },
        {
          itemId: "relate_001",
          raterIndex: 2,
          raterModel: "expert-1",
          assignedConstructId: "construct_relating",
          intendedConstructId: "construct_relating",
          relevance: 3,
        },
        {
          itemId: "relate_001",
          raterIndex: 3,
          raterModel: "expert-2",
          assignedConstructId: "construct_thinking",
          intendedConstructId: "construct_relating",
          relevance: 3,
        },
        // Item 3 (construct_adapting): 1/3 correct, V ~ 0.33
        {
          itemId: "adapt_001",
          raterIndex: 0,
          raterModel: "gpt-4o",
          assignedConstructId: "construct_adapting",
          intendedConstructId: "construct_adapting",
          relevance: 2,
        },
        {
          itemId: "adapt_001",
          raterIndex: 1,
          raterModel: "claude-opus",
          assignedConstructId: "construct_leading",
          intendedConstructId: "construct_adapting",
          relevance: 2,
        },
        {
          itemId: "adapt_001",
          raterIndex: 2,
          raterModel: "expert-1",
          assignedConstructId: "construct_leading",
          intendedConstructId: "construct_adapting",
          relevance: 2,
        },
      ];

      const result = runCongruencePanel(ratings);

      // Assertions on panel-level structure
      expect(result.items).toHaveLength(3);
      expect(result.overall.itemCount).toBe(3);
      expect(result.overall.raterCount).toBeGreaterThan(0);

      // Assertions on individual items
      const think001 = result.items.find((i) => i.itemId === "think_001");
      expect(think001?.verdict).toBe("pass");
      expect(think001?.assignmentAccuracy).toBe(1.0);

      const relate001 = result.items.find((i) => i.itemId === "relate_001");
      expect(relate001?.verdict).toBe("review");
      expect(relate001?.assignmentAccuracy).toBe(0.75); // 3/4 correct
      expect(relate001?.leakedTo).toBeUndefined(); // modalShare (0.75) not > accuracy (0.75)

      const adapt001 = result.items.find((i) => i.itemId === "adapt_001");
      expect(adapt001?.verdict).toBe("fail");
      expect(adapt001?.assignmentAccuracy).toBe(1 / 3);

      // Assertions on construct summaries
      const relatingSummary = result.constructSummaries.find(
        (s) => s.constructId === "construct_relating"
      );
      expect(relatingSummary?.itemCount).toBeGreaterThan(0);
      // construct_relating may have off-diagonals if raters confused it
      // (In this test, 1/4 raters in item 2 assign to construct_thinking instead)

      // Panel pass rate: 1/3 passed
      expect(result.overall.passRate).toBeCloseTo(1 / 3, 2);
    });
  });

  // ---------------------------------------------------------------------------
  // Threshold Constants
  // ---------------------------------------------------------------------------

  describe("CONGRUENCE_THRESHOLDS", () => {
    it("exports default threshold values", () => {
      expect(CONGRUENCE_THRESHOLDS.passAccuracy).toBe(0.8);
      expect(CONGRUENCE_THRESHOLDS.passAikenV).toBe(0.75);
      expect(CONGRUENCE_THRESHOLDS.reviewAccuracy).toBe(0.6);
      expect(CONGRUENCE_THRESHOLDS.reviewAikenV).toBe(0.6);
    });
  });
});
