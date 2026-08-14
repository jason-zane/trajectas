import { describe, expect, it } from "vitest";
import {
  mapWithConcurrency,
  chunk,
  DEFAULT_CONCURRENCY,
} from "@/lib/instrument/concurrency";

describe("mapWithConcurrency", () => {
  it("returns an empty array for empty input without invoking the worker", async () => {
    let calls = 0;
    const results = await mapWithConcurrency([], 4, async () => {
      calls++;
      return 1;
    });
    expect(results).toEqual([]);
    expect(calls).toBe(0);
  });

  it("preserves INPUT order even when tasks finish out of order", async () => {
    const delays = [40, 5, 30, 1, 20];
    const results = await mapWithConcurrency(delays, 5, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return i;
    });
    expect(results.map((r) => (r.ok ? r.value : -1))).toEqual([0, 1, 2, 3, 4]);
  });

  it("never exceeds the concurrency ceiling", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return true;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1); // proves it actually parallelised
  });

  it("processes every item exactly once", async () => {
    const seen: number[] = [];
    await mapWithConcurrency(Array.from({ length: 25 }, (_, i) => i), 4, async (n) => {
      seen.push(n);
      return n;
    });
    expect(seen.sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i));
  });

  it("isolates a rejecting task instead of aborting the run", async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n * 10;
    });
    expect(results[0]).toEqual({ ok: true, value: 10 });
    expect(results[1].ok).toBe(false);
    expect(results[2]).toEqual({ ok: true, value: 30 });
  });

  it("clamps a nonsensical limit rather than stalling or spinning", async () => {
    for (const limit of [0, -5, Number.NaN]) {
      const results = await mapWithConcurrency([1, 2, 3], limit, async (n) => n);
      expect(results.map((r) => (r.ok ? r.value : -1))).toEqual([1, 2, 3]);
    }
  });

  it("does not spawn more runners than there are items", async () => {
    const results = await mapWithConcurrency([1], 50, async (n) => n);
    expect(results).toHaveLength(1);
  });

  it("exposes a sane default concurrency", () => {
    expect(DEFAULT_CONCURRENCY).toBeGreaterThan(1);
    expect(DEFAULT_CONCURRENCY).toBeLessThanOrEqual(16);
  });
});

describe("chunk", () => {
  it("splits evenly and handles a trailing partial chunk", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns an empty array for empty input", () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it("clamps a nonsensical size to 1 rather than looping forever", () => {
    expect(chunk([1, 2], 0)).toEqual([[1], [2]]);
    expect(chunk([1, 2], -3)).toEqual([[1], [2]]);
  });

  it("returns a single chunk when size exceeds length", () => {
    expect(chunk([1, 2], 99)).toEqual([[1, 2]]);
  });
});
