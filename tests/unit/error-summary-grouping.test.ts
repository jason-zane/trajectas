import { describe, expect, it } from "vitest";
import { groupErrorRows } from "@/lib/dal/observability";

const row = (over: Partial<Parameters<typeof groupErrorRows>[0][number]>) => ({
  severity: "error",
  source: "reports.pdf",
  message: "boom",
  fingerprint: "reports.pdf:boom",
  occurred_at: "2026-06-01T00:00:00Z",
  ...over,
});

describe("groupErrorRows", () => {
  it("collapses rows by fingerprint and counts them", () => {
    const groups = groupErrorRows([
      row({ occurred_at: "2026-06-01T01:00:00Z" }),
      row({ occurred_at: "2026-06-01T03:00:00Z" }),
      row({ occurred_at: "2026-06-01T02:00:00Z" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(3);
    expect(groups[0].lastSeen).toBe("2026-06-01T03:00:00Z"); // max
  });

  it("sorts groups by count descending", () => {
    const groups = groupErrorRows([
      row({ fingerprint: "a:1", source: "a" }),
      row({ fingerprint: "b:1", source: "b" }),
      row({ fingerprint: "b:1", source: "b" }),
      row({ fingerprint: "b:1", source: "b" }),
    ]);
    expect(groups.map((g) => g.fingerprint)).toEqual(["b:1", "a:1"]);
    expect(groups[0].count).toBe(3);
  });

  it("falls back to source:message when fingerprint is null", () => {
    const groups = groupErrorRows([
      row({ fingerprint: null, source: "x", message: "y" }),
      row({ fingerprint: null, source: "x", message: "y" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].fingerprint).toBe("x:y");
    expect(groups[0].count).toBe(2);
  });

  it("returns an empty array for no rows", () => {
    expect(groupErrorRows([])).toEqual([]);
  });
});
