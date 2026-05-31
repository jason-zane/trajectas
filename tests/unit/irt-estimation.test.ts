import { describe, expect, it } from "vitest";
import { estimateMLE, estimateEAP } from "@/lib/scoring/irt/estimation";
import type { IRTParameters, IRTResponse } from "@/types/scoring";

// A small 2PL bank with difficulties spread across the scale.
const DIFFICULTIES = [-1.5, -0.5, 0.5, 1.5];
const itemBank = (): Map<string, IRTParameters> => {
  const m = new Map<string, IRTParameters>();
  DIFFICULTIES.forEach((b, i) => {
    m.set(`i${i + 1}`, { discrimination: 1.2, difficulty: b, guessing: 0, modelType: "2PL" });
  });
  return m;
};

const responses = (pattern: number[]): IRTResponse[] =>
  pattern.map((v, i) => ({ itemId: `i${i + 1}`, responseValue: v }));

// ---------------------------------------------------------------------------
// estimateMLE
// ---------------------------------------------------------------------------
describe("estimateMLE", () => {
  it("recovers a finite, bracketed estimate for a mixed pattern", () => {
    // Correct on the two easy items, wrong on the two hard ones.
    const est = estimateMLE(responses([1, 1, 0, 0]), itemBank());
    expect(Number.isFinite(est.theta)).toBe(true);
    expect(est.theta).toBeGreaterThan(-1.5);
    expect(est.theta).toBeLessThan(1.5);
    expect(est.standardError).toBeGreaterThan(0);
    expect(est.confidence.lower).toBeLessThan(est.theta);
    expect(est.confidence.upper).toBeGreaterThan(est.theta);
  });

  it("is monotonic: more correct answers give a higher ability estimate", () => {
    const fewer = estimateMLE(responses([1, 0, 0, 0]), itemBank());
    const more = estimateMLE(responses([1, 1, 1, 0]), itemBank());
    expect(more.theta).toBeGreaterThan(fewer.theta);
  });

  it("falls back to EAP for an all-correct pattern (MLE undefined) and stays finite & positive", () => {
    const est = estimateMLE(responses([1, 1, 1, 1]), itemBank());
    expect(Number.isFinite(est.theta)).toBe(true);
    expect(est.theta).toBeGreaterThan(0);
  });

  it("falls back to EAP for an all-incorrect pattern and stays finite & negative", () => {
    const est = estimateMLE(responses([0, 0, 0, 0]), itemBank());
    expect(Number.isFinite(est.theta)).toBe(true);
    expect(est.theta).toBeLessThan(0);
  });

  it("clamps within the theta bounds [-6, 6]", () => {
    const est = estimateMLE(responses([1, 1, 1, 0]), itemBank());
    expect(est.theta).toBeGreaterThanOrEqual(-6);
    expect(est.theta).toBeLessThanOrEqual(6);
  });

  it("ignores responses with no matching item parameters", () => {
    const withJunk: IRTResponse[] = [
      ...responses([1, 1, 0, 0]),
      { itemId: "does-not-exist", responseValue: 1 },
    ];
    const a = estimateMLE(withJunk, itemBank());
    const b = estimateMLE(responses([1, 1, 0, 0]), itemBank());
    expect(a.theta).toBeCloseTo(b.theta, 10);
  });

  it("throws when no responses match any item parameters", () => {
    expect(() =>
      estimateMLE([{ itemId: "ghost", responseValue: 1 }], itemBank()),
    ).toThrow(/No valid responses/);
  });
});

// ---------------------------------------------------------------------------
// estimateEAP
// ---------------------------------------------------------------------------
describe("estimateEAP", () => {
  it("returns a theta near the prior mean for a balanced pattern", () => {
    // Correct on easy, wrong on hard — symmetric around 0.
    const est = estimateEAP(responses([1, 1, 0, 0]), itemBank());
    expect(est.theta).toBeGreaterThan(-0.7);
    expect(est.theta).toBeLessThan(0.7);
    expect(est.standardError).toBeGreaterThan(0);
  });

  it("shrinks an all-incorrect estimate toward the prior (finite, not -Infinity)", () => {
    const est = estimateEAP(responses([0, 0, 0, 0]), itemBank());
    expect(Number.isFinite(est.theta)).toBe(true);
    expect(est.theta).toBeLessThan(0);
    expect(est.theta).toBeGreaterThan(-4); // bounded by the prior span
  });

  it("respects a shifted prior mean", () => {
    const neutral = estimateEAP(responses([1, 1, 0, 0]), itemBank(), 0, 1);
    const shifted = estimateEAP(responses([1, 1, 0, 0]), itemBank(), 1.5, 1);
    expect(shifted.theta).toBeGreaterThan(neutral.theta);
  });

  it("a tighter prior pulls the estimate closer to the prior mean", () => {
    const wide = estimateEAP(responses([1, 1, 1, 0]), itemBank(), 0, 1);
    const tight = estimateEAP(responses([1, 1, 1, 0]), itemBank(), 0, 0.3);
    expect(Math.abs(tight.theta)).toBeLessThan(Math.abs(wide.theta));
  });

  it("throws when no responses match any item parameters", () => {
    expect(() =>
      estimateEAP([{ itemId: "ghost", responseValue: 1 }], itemBank()),
    ).toThrow(/No valid responses/);
  });
});
