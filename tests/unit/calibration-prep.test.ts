import { describe, it, expect } from "vitest"
import {
  MIN_STABLE_N,
  MIN_COMPUTABLE_N,
  prepareConstructCalibration,
  type CalibrationResponseRow,
} from "@/lib/scoring/calibration-prep"

describe("prepareConstructCalibration", () => {
  // =========================================================================
  // Empty input
  // =========================================================================

  it("returns empty array for empty input", () => {
    const result = prepareConstructCalibration([])
    expect(result).toEqual([])
  })

  // =========================================================================
  // Single construct, complete cases
  // =========================================================================

  it("groups responses by construct", () => {
    const rows: CalibrationResponseRow[] = [
      { sessionId: "s1", itemId: "i1", constructId: "c1", value: 2, maxValue: 4, reverseScored: false },
      { sessionId: "s1", itemId: "i2", constructId: "c1", value: 3, maxValue: 4, reverseScored: false },
      { sessionId: "s2", itemId: "i1", constructId: "c2", value: 1, maxValue: 4, reverseScored: false },
      { sessionId: "s2", itemId: "i2", constructId: "c2", value: 2, maxValue: 4, reverseScored: false },
    ]

    const result = prepareConstructCalibration(rows)
    expect(result).toHaveLength(2)
    expect(result[0].constructId).toBe("c1")
    expect(result[1].constructId).toBe("c2")
  })

  it("processes a simple complete construct", () => {
    const rows: CalibrationResponseRow[] = []
    // Create 5 complete sessions (minimum for not being skipped)
    for (let s = 0; s < 5; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 2, maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: 3, maxValue: 4, reverseScored: false })
    }

    const result = prepareConstructCalibration(rows)
    expect(result).toHaveLength(1)

    const set = result[0]
    expect(set.constructId).toBe("c1")
    expect(set.itemIds).toEqual(["i1", "i2"])
    expect(set.completeSessions).toBe(5)
    expect(set.droppedIncompleteSessions).toBe(0)
    expect(set.skipped).toBe(false)
    expect(set.unstable).toBe(true) // 5 sessions < MIN_STABLE_N (100)
  })

  // =========================================================================
  // Deterministic ordering
  // =========================================================================

  it("sorts item IDs lexicographically", () => {
    const rows: CalibrationResponseRow[] = [
      { sessionId: "s1", itemId: "i3", constructId: "c1", value: 1, maxValue: 4, reverseScored: false },
      { sessionId: "s1", itemId: "i1", constructId: "c1", value: 2, maxValue: 4, reverseScored: false },
      { sessionId: "s1", itemId: "i2", constructId: "c1", value: 3, maxValue: 4, reverseScored: false },
      { sessionId: "s2", itemId: "i3", constructId: "c1", value: 4, maxValue: 4, reverseScored: false },
      { sessionId: "s2", itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false },
      { sessionId: "s2", itemId: "i2", constructId: "c1", value: 2, maxValue: 4, reverseScored: false },
    ]

    const result = prepareConstructCalibration(rows)
    expect(result[0].itemIds).toEqual(["i1", "i2", "i3"])
  })

  it("sorts session IDs lexicographically in person-by-item matrix", () => {
    const rows: CalibrationResponseRow[] = []
    // Create sessions in reverse order (s4, s3, s2, s1, s0) to test sorting
    for (let s = 4; s >= 0; s--) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 1 + s, maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: 2 + s, maxValue: 4, reverseScored: false })
    }

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    // personByItem should have s0 first, then s1-s4 (sorted lexicographically)
    expect(set.personByItem).toHaveLength(5)
    expect(set.personByItem[0]).toEqual([1, 2]) // s0: i1=1, i2=2
    expect(set.personByItem[1]).toEqual([2, 3]) // s1: i1=2, i2=3
    expect(set.personByItem[2]).toEqual([3, 4]) // s2: i1=3, i2=4
  })

  // =========================================================================
  // Complete-case filtering
  // =========================================================================

  it("drops incomplete sessions and counts them", () => {
    const rows: CalibrationResponseRow[] = []
    // Create 5 complete sessions (s0-s4)
    for (let s = 0; s < 5; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: 2, maxValue: 4, reverseScored: false })
    }
    // s5: incomplete (missing i2)
    rows.push({ sessionId: "s5", itemId: "i1", constructId: "c1", value: 3, maxValue: 4, reverseScored: false })
    // s6: incomplete (missing i1)
    rows.push({ sessionId: "s6", itemId: "i2", constructId: "c1", value: 4, maxValue: 4, reverseScored: false })

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    expect(set.completeSessions).toBe(5) // s0-s4
    expect(set.droppedIncompleteSessions).toBe(2) // s5, s6
    expect(set.personByItem).toHaveLength(5)
  })

  it("exact dropped count is correct", () => {
    const rows: CalibrationResponseRow[] = []
    // 5 complete sessions
    for (let s = 0; s < 5; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: 2, maxValue: 4, reverseScored: false })
    }
    // 3 incomplete sessions (missing i2)
    for (let s = 5; s < 8; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false })
    }

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    expect(set.completeSessions).toBe(5)
    expect(set.droppedIncompleteSessions).toBe(3)
  })

  // =========================================================================
  // Reverse scoring
  // =========================================================================

  it("applies reverse scoring to match buildResponseMatrix convention", () => {
    // buildResponseMatrix applies: effective = reverseScored ? maxValue - value : value
    // For a reverse-scored item with maxValue=4, value=1:
    //   effective = 4 - 1 = 3

    const rows: CalibrationResponseRow[] = []
    // Create 5 sessions to avoid skipping
    for (let s = 0; s < 5; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: true })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: 2, maxValue: 4, reverseScored: false })
    }

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    // All rows should have effective values: [3, 2]
    for (const row of set.personByItem) {
      expect(row).toEqual([3, 2])
    }
  })

  it("produces same effective values in personByItem as buildResponseMatrix would", () => {
    // Hand-computed case: 5 sessions, 2 items
    // Construct has i1 (not reversed, max=5) and i2 (reversed, max=3)
    //
    // s0: i1=4 (not reversed → 4), i2=1 (reversed, max=3 → 3-1=2)
    // s1: i1=2 (not reversed → 2), i2=2 (reversed, max=3 → 3-2=1)
    // s2: i1=3 (not reversed → 3), i2=3 (reversed, max=3 → 3-3=0)
    // s3, s4: same as s0

    const rows: CalibrationResponseRow[] = [
      { sessionId: "s0", itemId: "i1", constructId: "c1", value: 4, maxValue: 5, reverseScored: false },
      { sessionId: "s0", itemId: "i2", constructId: "c1", value: 1, maxValue: 3, reverseScored: true },
      { sessionId: "s1", itemId: "i1", constructId: "c1", value: 2, maxValue: 5, reverseScored: false },
      { sessionId: "s1", itemId: "i2", constructId: "c1", value: 2, maxValue: 3, reverseScored: true },
      { sessionId: "s2", itemId: "i1", constructId: "c1", value: 3, maxValue: 5, reverseScored: false },
      { sessionId: "s2", itemId: "i2", constructId: "c1", value: 3, maxValue: 3, reverseScored: true },
      { sessionId: "s3", itemId: "i1", constructId: "c1", value: 4, maxValue: 5, reverseScored: false },
      { sessionId: "s3", itemId: "i2", constructId: "c1", value: 1, maxValue: 3, reverseScored: true },
      { sessionId: "s4", itemId: "i1", constructId: "c1", value: 4, maxValue: 5, reverseScored: false },
      { sessionId: "s4", itemId: "i2", constructId: "c1", value: 1, maxValue: 3, reverseScored: true },
    ]

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    // Verify itemIds are sorted
    expect(set.itemIds).toEqual(["i1", "i2"])

    // Verify personByItem is correct (sessions sorted s0-s4)
    expect(set.personByItem).toEqual([
      [4, 2], // s0: i1=4, i2=1→2
      [2, 1], // s1: i1=2, i2=2→1
      [3, 0], // s2: i1=3, i2=3→0
      [4, 2], // s3: i1=4, i2=1→2
      [4, 2], // s4: i1=4, i2=1→2
    ])
  })

  it("handles both reversed and non-reversed items in the same construct", () => {
    const rows: CalibrationResponseRow[] = []
    // Create 5 sessions to avoid skipping
    const pattern = [
      [1, 1, 2],
      [3, 2, 3],
      [2, 1, 1],
      [4, 3, 4],
      [2, 2, 3],
    ]
    for (let s = 0; s < 5; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: pattern[s][0], maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: pattern[s][1], maxValue: 4, reverseScored: true })
      rows.push({ sessionId: `s${s}`, itemId: "i3", constructId: "c1", value: pattern[s][2], maxValue: 4, reverseScored: false })
    }

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    // s0: i1=1, i2=1→3, i3=2 → [1, 3, 2]
    // s1: i1=3, i2=2→2, i3=3 → [3, 2, 3]
    expect(set.personByItem[0]).toEqual([1, 3, 2])
    expect(set.personByItem[1]).toEqual([3, 2, 3])
    expect(set.personByItem).toHaveLength(5)
  })

  // =========================================================================
  // Duplicate handling
  // =========================================================================

  it("keeps the last occurrence when (sessionId, itemId) appears multiple times", () => {
    const rows: CalibrationResponseRow[] = []
    // Create 5 sessions to avoid skipping
    for (let s = 0; s < 5; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: 2, maxValue: 4, reverseScored: false })
    }
    // Duplicate: s0, i1 again with value=5 (should overwrite)
    rows.push({ sessionId: "s0", itemId: "i1", constructId: "c1", value: 5, maxValue: 4, reverseScored: false })

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    // Should keep the last value (5), not the first (1)
    // s0 should have [5, 2]
    expect(set.personByItem[0]).toEqual([5, 2])
    // All 5 sessions should be complete
    expect(set.personByItem).toHaveLength(5)
  })

  it("does not double-count duplicates in completeSessions", () => {
    const rows: CalibrationResponseRow[] = []
    // Create 5 sessions with duplicates in first one
    for (let s = 0; s < 5; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: 2, maxValue: 4, reverseScored: false })
    }
    // Duplicate: s0, i1 again (should overwrite)
    rows.push({ sessionId: "s0", itemId: "i1", constructId: "c1", value: 5, maxValue: 4, reverseScored: false })

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    // Should be 5 complete sessions (dedup doesn't affect count)
    expect(set.completeSessions).toBe(5)
    expect(set.personByItem).toHaveLength(5)
    // s0 should have the duplicate value (5) not the original (1)
    expect(set.personByItem[0][0]).toBe(5)
  })

  // =========================================================================
  // Skip conditions
  // =========================================================================

  it("skips construct with fewer than 2 items", () => {
    const rows: CalibrationResponseRow[] = [
      { sessionId: "s1", itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false },
      { sessionId: "s2", itemId: "i1", constructId: "c1", value: 2, maxValue: 4, reverseScored: false },
    ]

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    expect(set.skipped).toBe(true)
    expect(set.skipReason).toBe("Fewer than 2 items in construct")
    expect(set.personByItem).toEqual([])
    expect(set.completeSessions).toBe(0)
  })

  it("skips construct with fewer than MIN_COMPUTABLE_N complete sessions", () => {
    // MIN_COMPUTABLE_N = 5, so 4 complete sessions should be skipped
    const rows: CalibrationResponseRow[] = []
    for (let s = 0; s < 4; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: 2, maxValue: 4, reverseScored: false })
    }

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    expect(set.skipped).toBe(true)
    expect(set.skipReason).toContain(`Only 4 complete session(s)`)
    expect(set.personByItem).toEqual([])
  })

  it("does not skip when exactly MIN_COMPUTABLE_N sessions are present", () => {
    const rows: CalibrationResponseRow[] = []
    for (let s = 0; s < MIN_COMPUTABLE_N; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: 2, maxValue: 4, reverseScored: false })
    }

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    expect(set.skipped).toBe(false)
    expect(set.completeSessions).toBe(MIN_COMPUTABLE_N)
  })

  // =========================================================================
  // Unstable flag
  // =========================================================================

  it("flags as unstable when completeSessions < MIN_STABLE_N", () => {
    const rows: CalibrationResponseRow[] = []
    // Create MIN_STABLE_N - 1 sessions (99)
    for (let s = 0; s < MIN_STABLE_N - 1; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: 2, maxValue: 4, reverseScored: false })
    }

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    expect(set.unstable).toBe(true)
    expect(set.skipped).toBe(false)
    expect(set.completeSessions).toBe(MIN_STABLE_N - 1)
  })

  it("does not flag as unstable when exactly MIN_STABLE_N sessions are present", () => {
    const rows: CalibrationResponseRow[] = []
    for (let s = 0; s < MIN_STABLE_N; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: 2, maxValue: 4, reverseScored: false })
    }

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    expect(set.unstable).toBe(false)
    expect(set.skipped).toBe(false)
    expect(set.completeSessions).toBe(MIN_STABLE_N)
  })

  it("boundary: exactly 99 sessions is unstable", () => {
    const rows: CalibrationResponseRow[] = []
    for (let s = 0; s < 99; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: 2, maxValue: 4, reverseScored: false })
    }

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    expect(set.completeSessions).toBe(99)
    expect(set.unstable).toBe(true)
  })

  it("boundary: exactly 100 sessions is not unstable", () => {
    const rows: CalibrationResponseRow[] = []
    for (let s = 0; s < 100; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: 2, maxValue: 4, reverseScored: false })
    }

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    expect(set.completeSessions).toBe(100)
    expect(set.unstable).toBe(false)
  })

  it("does not flag as unstable when skipped", () => {
    // Only 1 item, so skipped, but completeSessions < MIN_STABLE_N
    const rows: CalibrationResponseRow[] = [
      { sessionId: "s1", itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false },
      { sessionId: "s2", itemId: "i1", constructId: "c1", value: 2, maxValue: 4, reverseScored: false },
    ]

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    expect(set.skipped).toBe(true)
    expect(set.unstable).toBe(false)
  })

  // =========================================================================
  // Multiple constructs
  // =========================================================================

  it("handles multiple constructs independently", () => {
    const rows: CalibrationResponseRow[] = []

    // Construct c1: 6 complete sessions (enough to not be skipped)
    for (let s = 0; s < 6; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: 2, maxValue: 4, reverseScored: false })
    }

    // Construct c2: only 3 complete sessions (less than MIN_COMPUTABLE_N, should be skipped)
    for (let s = 0; s < 3; s++) {
      rows.push({ sessionId: `c2_s${s}`, itemId: "i3", constructId: "c2", value: 1, maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `c2_s${s}`, itemId: "i4", constructId: "c2", value: 2, maxValue: 4, reverseScored: false })
    }

    const result = prepareConstructCalibration(rows)

    expect(result).toHaveLength(2)
    expect(result[0].constructId).toBe("c1")
    expect(result[0].completeSessions).toBe(6)
    expect(result[0].skipped).toBe(false)

    expect(result[1].constructId).toBe("c2")
    expect(result[1].completeSessions).toBe(3)
    expect(result[1].skipped).toBe(true)
  })

  it("returns constructs in sorted order", () => {
    const rows: CalibrationResponseRow[] = [
      { sessionId: "s1", itemId: "i1", constructId: "z", value: 1, maxValue: 4, reverseScored: false },
      { sessionId: "s1", itemId: "i2", constructId: "z", value: 2, maxValue: 4, reverseScored: false },
      { sessionId: "s1", itemId: "i3", constructId: "a", value: 1, maxValue: 4, reverseScored: false },
      { sessionId: "s1", itemId: "i4", constructId: "a", value: 2, maxValue: 4, reverseScored: false },
      { sessionId: "s1", itemId: "i5", constructId: "m", value: 1, maxValue: 4, reverseScored: false },
      { sessionId: "s1", itemId: "i6", constructId: "m", value: 2, maxValue: 4, reverseScored: false },
    ]

    const result = prepareConstructCalibration(rows)

    expect(result.map((s) => s.constructId)).toEqual(["a", "m", "z"])
  })

  // =========================================================================
  // Response array construction
  // =========================================================================

  it("includes all responses in responses array for complete sessions", () => {
    const rows: CalibrationResponseRow[] = []
    // Create 5 complete sessions so it doesn't get skipped
    for (let s = 0; s < 5; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 2, maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: 3, maxValue: 4, reverseScored: true })
    }

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    // 5 sessions × 2 items = 10 responses
    expect(set.responses).toHaveLength(10)
    // Verify structure of first two responses (from s0)
    expect(set.responses[0]).toEqual({ participantId: "s0", itemId: "i1", value: 2, maxValue: 4, reverseScored: false })
    expect(set.responses[1]).toEqual({ participantId: "s0", itemId: "i2", value: 3, maxValue: 4, reverseScored: true })
  })

  it("does not include dropped sessions in responses array", () => {
    const rows: CalibrationResponseRow[] = []
    // Create 5 complete sessions
    for (let s = 0; s < 5; s++) {
      rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false })
      rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c1", value: 2, maxValue: 4, reverseScored: false })
    }
    // Add an incomplete session (missing i2)
    rows.push({ sessionId: "sinc", itemId: "i1", constructId: "c1", value: 3, maxValue: 4, reverseScored: false })

    const result = prepareConstructCalibration(rows)
    const set = result[0]

    // Should only have responses from 5 complete sessions (5 × 2 items = 10 responses)
    expect(set.responses).toHaveLength(10)
    expect(set.droppedIncompleteSessions).toBe(1)
    // All responses should be from s0-s4, never from sinc
    for (const resp of set.responses) {
      expect(resp.participantId).toMatch(/^s[0-4]$/)
    }
  })

  // =========================================================================
  // Large sample behavior
  // =========================================================================

  it("handles large samples without throwing", () => {
    const rows: CalibrationResponseRow[] = []
    // 1000 sessions, 10 items
    for (let s = 0; s < 1000; s++) {
      for (let i = 0; i < 10; i++) {
        rows.push({
          sessionId: `s${s}`,
          itemId: `i${i}`,
          constructId: "c1",
          value: Math.floor(Math.random() * 4),
          maxValue: 4,
          reverseScored: Math.random() < 0.5,
        })
      }
    }

    const result = prepareConstructCalibration(rows)
    expect(result).toHaveLength(1)
    expect(result[0].completeSessions).toBe(1000)
    expect(result[0].personByItem).toHaveLength(1000)
    expect(result[0].personByItem[0]).toHaveLength(10)
  })

  // =========================================================================
  // Mixed skip and unstable scenarios
  // =========================================================================

  it("has correct skip/unstable combinations", () => {
    // c1: < 2 items → skipped
    const c1Rows: CalibrationResponseRow[] = [
      { sessionId: "s1", itemId: "i1", constructId: "c1", value: 1, maxValue: 4, reverseScored: false },
    ]

    // c2: < MIN_COMPUTABLE_N complete sessions → skipped
    const c2Rows: CalibrationResponseRow[] = []
    for (let s = 0; s < 3; s++) {
      c2Rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c2", value: 1, maxValue: 4, reverseScored: false })
      c2Rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c2", value: 2, maxValue: 4, reverseScored: false })
    }

    // c3: MIN_COMPUTABLE_N complete sessions but < MIN_STABLE_N → unstable
    const c3Rows: CalibrationResponseRow[] = []
    for (let s = 0; s < MIN_COMPUTABLE_N; s++) {
      c3Rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c3", value: 1, maxValue: 4, reverseScored: false })
      c3Rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c3", value: 2, maxValue: 4, reverseScored: false })
    }

    // c4: >= MIN_STABLE_N complete sessions → stable
    const c4Rows: CalibrationResponseRow[] = []
    for (let s = 0; s < MIN_STABLE_N + 10; s++) {
      c4Rows.push({ sessionId: `s${s}`, itemId: "i1", constructId: "c4", value: 1, maxValue: 4, reverseScored: false })
      c4Rows.push({ sessionId: `s${s}`, itemId: "i2", constructId: "c4", value: 2, maxValue: 4, reverseScored: false })
    }

    const allRows = [...c1Rows, ...c2Rows, ...c3Rows, ...c4Rows]
    const result = prepareConstructCalibration(allRows)

    expect(result).toHaveLength(4)

    const c1Set = result[0]
    expect(c1Set.constructId).toBe("c1")
    expect(c1Set.skipped).toBe(true)
    expect(c1Set.unstable).toBe(false)

    const c2Set = result[1]
    expect(c2Set.constructId).toBe("c2")
    expect(c2Set.skipped).toBe(true)
    expect(c2Set.unstable).toBe(false)

    const c3Set = result[2]
    expect(c3Set.constructId).toBe("c3")
    expect(c3Set.skipped).toBe(false)
    expect(c3Set.unstable).toBe(true)

    const c4Set = result[3]
    expect(c4Set.constructId).toBe("c4")
    expect(c4Set.skipped).toBe(false)
    expect(c4Set.unstable).toBe(false)
  })
})
