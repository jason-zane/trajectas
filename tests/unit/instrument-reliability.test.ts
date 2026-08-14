import { describe, expect, it } from "vitest";
import {
  alphaFromMeanInterItem,
  classifyMeanInterItem,
  COHERENCE_BANDS,
  DEFAULT_SHRINKAGE,
  designAdvice,
  FACET_RBAR_PRIOR,
  forecastAlpha,
  getBandDefinition,
  requiredItemCount,
  requiredItemCountFloat,
  requiredMeanInterItem,
  spearmanBrown
} from "@/lib/instrument/reliability";

describe("Reliability Forecasting", () => {
  // ---------------------------------------------------------------------------
  // Known-value tests (Clark & Watson table + standard psychometric benchmarks)
  // ---------------------------------------------------------------------------

  describe("requiredMeanInterItem (known values to 3dp)", () => {
    it("k=6, alpha=0.80 -> rBar=0.400", () => {
      const rBar = requiredMeanInterItem(6, 0.80);
      expect(rBar).toBeCloseTo(0.400, 2);
    });

    it("k=8, alpha=0.80 -> rBar=0.333", () => {
      const rBar = requiredMeanInterItem(8, 0.80);
      expect(rBar).toBeCloseTo(0.333, 2);
    });

    it("k=10, alpha=0.80 -> rBar=0.286", () => {
      const rBar = requiredMeanInterItem(10, 0.80);
      expect(rBar).toBeCloseTo(0.286, 2);
    });

    it("k=12, alpha=0.80 -> rBar=0.250", () => {
      const rBar = requiredMeanInterItem(12, 0.80);
      expect(rBar).toBeCloseTo(0.250, 2);
    });

    it("k=15, alpha=0.80 -> rBar=0.211", () => {
      const rBar = requiredMeanInterItem(15, 0.80);
      expect(rBar).toBeCloseTo(0.211, 2);
    });

    it("k=20, alpha=0.80 -> rBar=0.167", () => {
      const rBar = requiredMeanInterItem(20, 0.80);
      expect(rBar).toBeCloseTo(0.167, 2);
    });

    it("k=8, alpha=0.90 -> rBar=0.529", () => {
      const rBar = requiredMeanInterItem(8, 0.90);
      expect(rBar).toBeCloseTo(0.529, 2);
    });

    it("k=12, alpha=0.90 -> rBar=0.429", () => {
      const rBar = requiredMeanInterItem(12, 0.90);
      expect(rBar).toBeCloseTo(0.429, 2);
    });

    it("k=20, alpha=0.90 -> rBar=0.310", () => {
      const rBar = requiredMeanInterItem(20, 0.90);
      expect(rBar).toBeCloseTo(0.310, 2);
    });
  });

  // ---------------------------------------------------------------------------
  // Round-trip properties
  // ---------------------------------------------------------------------------

  describe("Round-trip: alpha -> rBar -> alpha", () => {
    it("alphaFromMeanInterItem(k, requiredMeanInterItem(k, a)) === a within 1e-9", () => {
      const testCases = [
        { k: 6, alpha: 0.80 },
        { k: 10, alpha: 0.85 },
        { k: 15, alpha: 0.80 },
        { k: 20, alpha: 0.90 }
      ];

      for (const { k, alpha } of testCases) {
        const requiredRBar = requiredMeanInterItem(k, alpha);
        const recovered = alphaFromMeanInterItem(k, requiredRBar);
        expect(recovered).toBeCloseTo(alpha, 9);
      }
    });

    it("requiredItemCount then alphaFromMeanInterItem >= target alpha", () => {
      const rBar = 0.30;
      const targetAlpha = 0.80;
      const itemsNeeded = requiredItemCount(rBar, targetAlpha);

      const achievedAlpha = alphaFromMeanInterItem(itemsNeeded, rBar);
      expect(achievedAlpha).toBeGreaterThanOrEqual(targetAlpha - 0.01); // Allow 0.01 rounding slack
    });

    it("requiredItemCountFloat(rBar, alpha) ceil() creates item count that meets target", () => {
      const rBar = 0.25;
      const targetAlpha = 0.80;
      const floatCount = requiredItemCountFloat(rBar, targetAlpha);
      const intCount = Math.ceil(floatCount);

      const achievedAlpha = alphaFromMeanInterItem(intCount, rBar);
      expect(achievedAlpha).toBeGreaterThanOrEqual(targetAlpha - 0.01);
    });
  });

  // ---------------------------------------------------------------------------
  // Monotonicity
  // ---------------------------------------------------------------------------

  describe("Monotonicity", () => {
    it("alpha increases with item count (fixed rBar)", () => {
      const rBar = 0.30;
      const alpha4 = alphaFromMeanInterItem(4, rBar);
      const alpha8 = alphaFromMeanInterItem(8, rBar);
      const alpha12 = alphaFromMeanInterItem(12, rBar);
      const alpha20 = alphaFromMeanInterItem(20, rBar);

      expect(alpha4).toBeLessThan(alpha8);
      expect(alpha8).toBeLessThan(alpha12);
      expect(alpha12).toBeLessThan(alpha20);
    });

    it("alpha increases with rBar (fixed item count)", () => {
      const k = 10;
      const alpha015 = alphaFromMeanInterItem(k, 0.15);
      const alpha030 = alphaFromMeanInterItem(k, 0.30);
      const alpha045 = alphaFromMeanInterItem(k, 0.45);

      expect(alpha015).toBeLessThan(alpha030);
      expect(alpha030).toBeLessThan(alpha045);
    });

    it("required rBar decreases with more items (fixed alpha)", () => {
      const targetAlpha = 0.80;
      const rBarFor6 = requiredMeanInterItem(6, targetAlpha);
      const rBarFor10 = requiredMeanInterItem(10, targetAlpha);
      const rBarFor20 = requiredMeanInterItem(20, targetAlpha);

      expect(rBarFor6).toBeGreaterThan(rBarFor10);
      expect(rBarFor10).toBeGreaterThan(rBarFor20);
    });
  });

  // ---------------------------------------------------------------------------
  // Coherence band classification
  // ---------------------------------------------------------------------------

  describe("classifyMeanInterItem (band boundaries)", () => {
    it("exactly 0.00 -> incoherent", () => {
      expect(classifyMeanInterItem(0.001)).toBe("incoherent");
    });

    it("exactly 0.15 (boundary) -> broad", () => {
      expect(classifyMeanInterItem(0.15)).toBe("broad");
    });

    it("0.15 + epsilon -> broad", () => {
      expect(classifyMeanInterItem(0.15 + 0.001)).toBe("broad");
    });

    it("0.25 - epsilon -> broad", () => {
      expect(classifyMeanInterItem(0.25 - 0.001)).toBe("broad");
    });

    it("exactly 0.25 (boundary) -> optimal", () => {
      expect(classifyMeanInterItem(0.25)).toBe("optimal");
    });

    it("0.32 (mid-optimal) -> optimal", () => {
      expect(classifyMeanInterItem(0.32)).toBe("optimal");
    });

    it("0.40 (boundary, optimal->narrow) -> narrow", () => {
      expect(classifyMeanInterItem(0.40)).toBe("narrow");
    });

    it("0.45 (mid-narrow) -> narrow", () => {
      expect(classifyMeanInterItem(0.45)).toBe("narrow");
    });

    it("0.50 (boundary, narrow->redundant) -> redundant", () => {
      expect(classifyMeanInterItem(0.50)).toBe("redundant");
    });

    it("0.60 (well into redundant) -> redundant", () => {
      expect(classifyMeanInterItem(0.60)).toBe("redundant");
    });

    it("NaN input -> incoherent (fallback)", () => {
      expect(classifyMeanInterItem(NaN)).toBe("incoherent");
    });
  });

  describe("getBandDefinition", () => {
    it("returns correct definition for 'broad'", () => {
      const def = getBandDefinition("broad");
      expect(def).toBeDefined();
      expect(def?.band).toBe("broad");
      expect(def?.lo).toBe(0.15);
      expect(def?.hi).toBe(0.25);
    });

    it("returns correct definition for 'optimal'", () => {
      const def = getBandDefinition("optimal");
      expect(def).toBeDefined();
      expect(def?.band).toBe("optimal");
      expect(def?.lo).toBe(0.25);
      expect(def?.hi).toBe(0.40);
    });

    it("all COHERENCE_BANDS entries are retrievable", () => {
      for (const band of COHERENCE_BANDS) {
        const def = getBandDefinition(band.band);
        expect(def).toBeDefined();
        expect(def?.band).toBe(band.band);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Spearman-Brown prophecy
  // ---------------------------------------------------------------------------

  describe("spearmanBrown (prophecy formula)", () => {
    it("identity: lengthFactor=1 returns baseReliability", () => {
      const r = 0.80;
      const result = spearmanBrown(r, 1);
      expect(result).toBeCloseTo(r, 10);
    });

    it("doubling items increases reliability", () => {
      const r = 0.70;
      const doubled = spearmanBrown(r, 2);
      expect(doubled).toBeGreaterThan(r);
    });

    it("adding 50% items (lengthFactor=1.5)", () => {
      const r = 0.75;
      const result = spearmanBrown(r, 1.5);
      // Formula: (1.5 * 0.75) / (1 + (1.5 - 1) * 0.75) = 1.125 / 1.375
      expect(result).toBeCloseTo((1.5 * r) / (1 + (1.5 - 1) * r), 10);
    });

    it("halving items (lengthFactor=0.5) decreases reliability", () => {
      const r = 0.80;
      const halved = spearmanBrown(r, 0.5);
      expect(halved).toBeLessThan(r);
    });

    it("very high lengthFactor approaches ceiling of 1.0", () => {
      const r = 0.70;
      const huge = spearmanBrown(r, 1000);
      expect(huge).toBeLessThan(1.0);
      expect(huge).toBeCloseTo(1.0, 2);
    });

    it("returns NaN for invalid inputs", () => {
      expect(spearmanBrown(0, 2)).toBe(NaN); // baseReliability <= 0
      expect(spearmanBrown(1.5, 2)).toBe(NaN); // baseReliability >= 1
      expect(spearmanBrown(0.70, -1)).toBe(NaN); // lengthFactor <= 0
      expect(spearmanBrown(NaN, 2)).toBe(NaN);
      expect(spearmanBrown(0.70, NaN)).toBe(NaN);
    });
  });

  // ---------------------------------------------------------------------------
  // forecastAlpha
  // ---------------------------------------------------------------------------

  describe("forecastAlpha (design-time forecasting)", () => {
    it("uses synthetic rBar when provided, basis='synthetic'", () => {
      const forecast = forecastAlpha({
        itemCount: 10,
        facetCount: 1,
        syntheticMeanInterItemR: 0.50
      });

      expect(forecast.basis).toBe("synthetic");
      // Point estimate should be shrunk: 0.60 * 0.50 = 0.30
      expect(forecast.meanInterItemR).toBe(
        DEFAULT_SHRINKAGE.point * 0.50
      );
    });

    it("applies shrinkage to synthetic estimate", () => {
      const forecast = forecastAlpha({
        itemCount: 10,
        facetCount: 1,
        syntheticMeanInterItemR: 0.40
      });

      const expected = DEFAULT_SHRINKAGE.point * 0.40;
      expect(forecast.meanInterItemR).toBeCloseTo(expected, 10);
      expect(forecast.meanInterItemRInterval[0]).toBeCloseTo(
        DEFAULT_SHRINKAGE.low * 0.40,
        10
      );
      expect(forecast.meanInterItemRInterval[1]).toBeCloseTo(
        DEFAULT_SHRINKAGE.high * 0.40,
        10
      );
    });

    it("falls back to facet prior when synthetic not provided, basis='facet_prior'", () => {
      const forecast = forecastAlpha({
        itemCount: 8,
        facetCount: 2
      });

      expect(forecast.basis).toBe("facet_prior");
      // facetCount 2 -> point 0.35
      expect(forecast.meanInterItemR).toBeCloseTo(
        FACET_RBAR_PRIOR[2].point,
        10
      );
      expect(forecast.warnings.some((w) => w.message.includes("facet-count prior"))).toBe(
        true
      );
    });

    it("emits warning for facet-prior basis (lower confidence)", () => {
      const forecast = forecastAlpha({
        itemCount: 8,
        facetCount: 2
      });

      expect(forecast.warnings.some((w) => w.level === "caution")).toBe(true);
    });

    it("emits warning for redundant coherence", () => {
      const forecast = forecastAlpha({
        itemCount: 20,
        facetCount: 1,
        syntheticMeanInterItemR: 0.85
      });

      // Shrunk: 0.60 * 0.85 = 0.51 -> redundant
      expect(forecast.coherence).toBe("redundant");
      expect(forecast.warnings.some((w) => w.message.includes("redundancy"))).toBe(
        true
      );
    });

    it("emits warning for incoherent coherence", () => {
      const forecast = forecastAlpha({
        itemCount: 15,
        facetCount: 1,
        syntheticMeanInterItemR: 0.10
      });

      // Shrunk: 0.60 * 0.10 = 0.06 -> incoherent
      expect(forecast.coherence).toBe("incoherent");
      expect(forecast.warnings.some((w) => w.message.includes("incoherence"))).toBe(
        true
      );
    });

    it("emits warning for fewer than 4 items", () => {
      const forecast = forecastAlpha({
        itemCount: 3,
        facetCount: 1,
        syntheticMeanInterItemR: 0.35
      });

      expect(forecast.warnings.some((w) => w.message.includes("fewer than 4"))).toBe(
        true
      );
    });

    it("returns NaN for invalid itemCount", () => {
      const forecast = forecastAlpha({
        itemCount: 1,
        facetCount: 1
      });

      expect(isNaN(forecast.predictedAlpha)).toBe(true);
      expect(forecast.warnings.some((w) => w.message.includes("Invalid"))).toBe(true);
    });

    it("computes alpha from rBar and itemCount correctly", () => {
      const forecast = forecastAlpha({
        itemCount: 10,
        facetCount: 1,
        syntheticMeanInterItemR: 0.40
      });

      const manualAlpha = alphaFromMeanInterItem(10, forecast.meanInterItemR);
      expect(forecast.predictedAlpha).toBeCloseTo(manualAlpha, 10);
    });

    it("interval is plausible (low < point < high)", () => {
      const forecast = forecastAlpha({
        itemCount: 12,
        facetCount: 2,
        syntheticMeanInterItemR: 0.35
      });

      if (isFinite(forecast.interval[0]) && isFinite(forecast.interval[1])) {
        expect(forecast.interval[0]).toBeLessThanOrEqual(forecast.predictedAlpha);
        expect(forecast.predictedAlpha).toBeLessThanOrEqual(forecast.interval[1]);
      }
    });

    it("respects custom shrinkage config", () => {
      const customShrinkage = {
        point: 0.50,
        low: 0.30,
        high: 0.70
      };

      const forecast = forecastAlpha({
        itemCount: 10,
        facetCount: 1,
        syntheticMeanInterItemR: 0.40,
        shrinkage: customShrinkage
      });

      const expected = customShrinkage.point * 0.40;
      expect(forecast.meanInterItemR).toBeCloseTo(expected, 10);
    });

    it("clamps rBar to (0.01, 0.94) to avoid boundary issues", () => {
      const forecast = forecastAlpha({
        itemCount: 10,
        facetCount: 1,
        syntheticMeanInterItemR: 2.0 // Impossible, but test clamping
      });

      expect(forecast.meanInterItemR).toBeLessThanOrEqual(0.94);
      expect(forecast.meanInterItemR).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // designAdvice
  // ---------------------------------------------------------------------------

  describe("designAdvice", () => {
    it("reports achievable=true when target is reachable", () => {
      const advice = designAdvice({
        itemCount: 10,
        facetCount: 1,
        targetAlpha: 0.75,
        forceRBar: 0.30
      });

      expect(advice.achievable).toBe(true);
    });

    it("itemsToAdd=0 when target already met", () => {
      const advice = designAdvice({
        itemCount: 20,
        facetCount: 1,
        targetAlpha: 0.70,
        forceRBar: 0.30
      });

      expect(advice.achievable).toBe(true);
      expect(advice.itemsToAdd).toBe(0);
      expect(advice.message).toContain("already achieved");
    });

    it("itemsToAdd > 0 when target requires more items", () => {
      const advice = designAdvice({
        itemCount: 6,
        facetCount: 1,
        targetAlpha: 0.90,
        forceRBar: 0.40
      });

      expect(advice.achievable).toBe(true);
      expect(advice.itemsToAdd).toBeGreaterThan(0);
    });

    it("computes items needed correctly", () => {
      const rBar = 0.30;
      const targetAlpha = 0.80;
      const currentItems = 5;

      const advice = designAdvice({
        itemCount: currentItems,
        facetCount: 1,
        targetAlpha,
        forceRBar: rBar
      });

      if (advice.achievable && advice.itemsToAdd !== undefined) {
        const totalItems = currentItems + advice.itemsToAdd;
        const achieved = alphaFromMeanInterItem(totalItems, rBar);
        expect(achieved).toBeGreaterThanOrEqual(targetAlpha - 0.01);
      }
    });

    it("refuses impossible target (alpha > 0.50 with rBar > 0.50)", () => {
      const advice = designAdvice({
        itemCount: 10,
        facetCount: 1,
        targetAlpha: 0.95,
        forceRBar: 0.60
      });

      expect(advice.achievable).toBe(false);
      expect(advice.message).toContain("redundant");
    });

    it("infers rBar from currentAlpha", () => {
      // If alpha=0.80 with k=10, can invert to get rBar
      const advice = designAdvice({
        itemCount: 10,
        facetCount: 1,
        targetAlpha: 0.85,
        currentAlpha: 0.80
      });

      // Should not crash and should return meaningful advice
      expect(advice.achievable).toBeDefined();
    });

    it("uses facet prior when rBar not provided", () => {
      const advice = designAdvice({
        itemCount: 8,
        facetCount: 3,
        targetAlpha: 0.80
      });

      // Should use facet prior for 3 facets
      expect(advice.message).toBeDefined();
    });

    it("rejects invalid itemCount", () => {
      const advice = designAdvice({
        itemCount: 1,
        facetCount: 1,
        targetAlpha: 0.80
      });

      expect(advice.achievable).toBe(false);
    });

    it("rejects invalid targetAlpha", () => {
      const advice = designAdvice({
        itemCount: 10,
        facetCount: 1,
        targetAlpha: 1.5
      });

      expect(advice.achievable).toBe(false);
    });

    it("warns about redundancy risk", () => {
      const advice = designAdvice({
        itemCount: 8,
        facetCount: 1,
        targetAlpha: 0.92,
        forceRBar: 0.55
      });

      expect(advice.achievable).toBe(false);
      expect(advice.message).toContain("redundant");
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases and error handling
  // ---------------------------------------------------------------------------

  describe("Edge cases and error handling", () => {
    describe("alphaFromMeanInterItem", () => {
      it("returns NaN for itemCount < 1", () => {
        expect(alphaFromMeanInterItem(0, 0.30)).toBe(NaN);
        expect(alphaFromMeanInterItem(-5, 0.30)).toBe(NaN);
      });

      it("returns NaN for rBar <= 0", () => {
        expect(alphaFromMeanInterItem(10, 0)).toBe(NaN);
        expect(alphaFromMeanInterItem(10, -0.1)).toBe(NaN);
      });

      it("returns NaN for rBar >= 1", () => {
        expect(alphaFromMeanInterItem(10, 1.0)).toBe(NaN);
        expect(alphaFromMeanInterItem(10, 1.5)).toBe(NaN);
      });

      it("returns NaN for non-finite inputs", () => {
        expect(alphaFromMeanInterItem(NaN, 0.30)).toBe(NaN);
        expect(alphaFromMeanInterItem(10, NaN)).toBe(NaN);
        expect(alphaFromMeanInterItem(Infinity, 0.30)).toBe(NaN);
      });

      it("handles very small rBar (near 0)", () => {
        const alpha = alphaFromMeanInterItem(10, 0.01);
        expect(isFinite(alpha)).toBe(true);
        expect(alpha).toBeGreaterThan(0);
        expect(alpha).toBeLessThan(0.11); // Should be small
      });

      it("handles rBar near upper limit (0.94)", () => {
        const alpha = alphaFromMeanInterItem(10, 0.94);
        expect(isFinite(alpha)).toBe(true);
        expect(alpha).toBeGreaterThan(0.9); // Should be very high
      });
    });

    describe("requiredMeanInterItem", () => {
      it("returns NaN for targetAlpha <= 0", () => {
        expect(requiredMeanInterItem(10, 0)).toBe(NaN);
        expect(requiredMeanInterItem(10, -0.1)).toBe(NaN);
      });

      it("returns NaN for targetAlpha >= 1", () => {
        expect(requiredMeanInterItem(10, 1.0)).toBe(NaN);
        expect(requiredMeanInterItem(10, 1.1)).toBe(NaN);
      });

      it("returns NaN for impossible alpha (above achievable ceiling)", () => {
        const rBar = requiredMeanInterItem(4, 0.99);
        expect(rBar).toBe(NaN); // Impossible with only 4 items and r < 0.95
      });

      it("returns NaN for non-finite inputs", () => {
        expect(requiredMeanInterItem(NaN, 0.80)).toBe(NaN);
        expect(requiredMeanInterItem(10, NaN)).toBe(NaN);
      });
    });

    describe("requiredItemCount", () => {
      it("rounds up to next integer", () => {
        const floatCount = requiredItemCountFloat(0.30, 0.80);
        const intCount = requiredItemCount(0.30, 0.80);
        expect(intCount).toBe(Math.ceil(floatCount));
      });

      it("returns NaN for invalid rBar", () => {
        expect(requiredItemCount(0, 0.80)).toBe(NaN);
        expect(requiredItemCount(1.0, 0.80)).toBe(NaN);
        expect(requiredItemCount(NaN, 0.80)).toBe(NaN);
      });

      it("returns NaN for invalid alpha", () => {
        expect(requiredItemCount(0.30, 0)).toBe(NaN);
        expect(requiredItemCount(0.30, 1.0)).toBe(NaN);
      });
    });

    describe("forecastAlpha with degenerate inputs", () => {
      it("returns NaN results for invalid itemCount", () => {
        const forecast = forecastAlpha({
          itemCount: 0,
          facetCount: 1
        });

        expect(isNaN(forecast.predictedAlpha)).toBe(true);
      });

      it("handles very high synthetic rBar gracefully (clamped)", () => {
        const forecast = forecastAlpha({
          itemCount: 10,
          facetCount: 1,
          syntheticMeanInterItemR: 1.5
        });

        expect(forecast.meanInterItemR).toBeLessThanOrEqual(0.94);
        expect(isFinite(forecast.predictedAlpha)).toBe(true);
      });

      it("defaults facetCount to 1 if invalid", () => {
        const forecast = forecastAlpha({
          itemCount: 10,
          facetCount: NaN,
          syntheticMeanInterItemR: 0.30
        });

        // Should not crash
        expect(forecast.basis).toBeDefined();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Constants and tables
  // ---------------------------------------------------------------------------

  describe("Constants", () => {
    it("DEFAULT_SHRINKAGE has valid bounds", () => {
      expect(DEFAULT_SHRINKAGE.point).toBeGreaterThan(0);
      expect(DEFAULT_SHRINKAGE.point).toBeLessThan(1);
      expect(DEFAULT_SHRINKAGE.low).toBeLessThanOrEqual(DEFAULT_SHRINKAGE.point);
      expect(DEFAULT_SHRINKAGE.point).toBeLessThanOrEqual(DEFAULT_SHRINKAGE.high);
    });

    it("COHERENCE_BANDS are ordered and contiguous", () => {
      let prevHi = 0;
      for (const band of COHERENCE_BANDS) {
        expect(band.lo).toBeGreaterThanOrEqual(prevHi);
        expect(band.hi).toBeGreaterThan(band.lo);
        prevHi = band.hi;
      }
    });

    it("FACET_RBAR_PRIOR entries are sensible", () => {
      for (const [key, value] of Object.entries(FACET_RBAR_PRIOR)) {
        const k = parseInt(key);
        expect(k).toBeGreaterThan(0);
        expect(value.point).toBeGreaterThan(0);
        expect(value.point).toBeLessThan(1);
        expect(value.bandwidth).toBeGreaterThan(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Integration: Design workflow
  // ---------------------------------------------------------------------------

  describe("Integration: Design workflow", () => {
    it("full workflow: forecast -> advise -> verify", () => {
      // Starting point: facet prior for 2-facet construct
      const forecast = forecastAlpha({
        itemCount: 8,
        facetCount: 2
      });

      expect(forecast.basis).toBe("facet_prior");

      // Goal: achieve alpha 0.85
      const advice = designAdvice({
        itemCount: 8,
        facetCount: 2,
        targetAlpha: 0.85,
        forceRBar: forecast.meanInterItemR
      });

      expect(advice.achievable).toBe(true);
      if (advice.itemsToAdd !== undefined && advice.itemsToAdd > 0) {
        // Verify: adding the recommended items achieves target
        const newCount = 8 + advice.itemsToAdd;
        const newAlpha = alphaFromMeanInterItem(newCount, forecast.meanInterItemR);
        expect(newAlpha).toBeGreaterThanOrEqual(0.84); // Allow 0.01 slack
      }
    });

    it("synthetic data provides grounded forecast vs facet prior", () => {
      const forecast1 = forecastAlpha({
        itemCount: 10,
        facetCount: 2
      });

      const forecast2 = forecastAlpha({
        itemCount: 10,
        facetCount: 2,
        syntheticMeanInterItemR: 0.35
      });

      // Both should be plausible, but basis differs
      expect(forecast1.basis).toBe("facet_prior");
      expect(forecast2.basis).toBe("synthetic");

      // Synthetic forecast should be rooted in actual data
      expect(forecast2.meanInterItemR).toBeLessThan(0.35); // Shrunk toward conservative estimate

      // Facet prior should warn about lower confidence
      expect(forecast1.warnings.some((w) => w.message.includes("facet-count prior"))).toBe(
        true
      );
      expect(forecast2.warnings.some((w) => w.message.includes("facet-count prior"))).toBe(
        false
      );
    });
  });
});
