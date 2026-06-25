import { describe, expect, it } from "vitest";

import { classifyUsageHealth, needsAttention } from "@/lib/business/health-helpers";
import type { SeriesPoint } from "@/lib/business/finance-helpers";

// Build a 6-month series (oldest→newest) from raw monthly values.
function series(values: number[]): SeriesPoint[] {
  return values.map((value, i) => ({ key: `m${i}`, label: `M${i}`, value }));
}

describe("classifyUsageHealth", () => {
  it("returns none for an empty or all-zero series", () => {
    expect(classifyUsageHealth([])).toBe("none");
    expect(classifyUsageHealth(series([0, 0, 0, 0, 0, 0]))).toBe("none");
  });

  it("flags dormant when nothing completed in the last 3 months", () => {
    // activity 4 months ago, nothing since
    expect(classifyUsageHealth(series([5, 4, 0, 0, 0, 0]))).toBe("dormant");
  });

  it("flags growing when recent 3 months exceed the prior 3", () => {
    expect(classifyUsageHealth(series([1, 1, 1, 4, 5, 6]))).toBe("growing");
  });

  it("flags declining when recent 3 months drop well below prior 3", () => {
    expect(classifyUsageHealth(series([6, 5, 4, 1, 0, 1]))).toBe("declining");
  });

  it("flags steady when usage is roughly flat", () => {
    expect(classifyUsageHealth(series([3, 3, 3, 3, 3, 3]))).toBe("steady");
  });

  it("treats first-ever recent usage as growing", () => {
    expect(classifyUsageHealth(series([0, 0, 0, 2, 3, 4]))).toBe("growing");
  });
});

describe("needsAttention", () => {
  it("is true only for declining/dormant", () => {
    expect(needsAttention("declining")).toBe(true);
    expect(needsAttention("dormant")).toBe(true);
    expect(needsAttention("growing")).toBe(false);
    expect(needsAttention("steady")).toBe(false);
    expect(needsAttention("none")).toBe(false);
  });
});
