import { describe, expect, it } from "vitest"
import {
  aggregateThreeSixty,
  type SessionScore,
} from "@/lib/scoring/three-sixty"

const F = "factor-1"

function self(score: number): SessionScore {
  return { category: "self", factorScores: { [F]: score } }
}
function obs(category: SessionScore["category"], score: number): SessionScore {
  return { category, factorScores: { [F]: score } }
}

describe("aggregateThreeSixty — anonymity suppression", () => {
  it("suppresses a peer category with fewer than 3 raters", () => {
    const agg = aggregateThreeSixty(
      [self(70), obs("peer", 60), obs("peer", 50)],
      [F],
    )
    const peer = agg.factors[0].categories.find((c) => c.category === "peer")!
    expect(peer.n).toBe(2)
    expect(peer.suppressed).toBe(true)
    expect(peer.mean).toBeNull()
  })

  it("shows a peer category once it reaches 3 raters", () => {
    const agg = aggregateThreeSixty(
      [self(70), obs("peer", 60), obs("peer", 50), obs("peer", 40)],
      [F],
    )
    const peer = agg.factors[0].categories.find((c) => c.category === "peer")!
    expect(peer.n).toBe(3)
    expect(peer.suppressed).toBe(false)
    expect(peer.mean).toBeCloseTo(50)
  })

  it("never suppresses the manager category (named, exempt)", () => {
    const agg = aggregateThreeSixty([self(70), obs("manager", 65)], [F])
    const mgr = agg.factors[0].categories.find((c) => c.category === "manager")!
    expect(mgr.suppressed).toBe(false)
    expect(mgr.mean).toBeCloseTo(65)
  })
})

describe("aggregateThreeSixty — per-factor anonymity", () => {
  it("suppresses a category that meets headcount but lacks 3 scores for the factor", () => {
    // 3 peers, but only 2 answered this factor → must still be suppressed.
    const peerNoScore: SessionScore = { category: "peer", factorScores: {} }
    const agg = aggregateThreeSixty(
      [self(70), obs("peer", 50), obs("peer", 50), peerNoScore],
      [F],
    )
    const peer = agg.factors[0].categories.find((c) => c.category === "peer")!
    expect(peer.n).toBe(2)
    expect(peer.suppressed).toBe(true)
    expect(peer.mean).toBeNull()
    // and those 2 sub-threshold scores must not leak via othersMean
    expect(agg.factors[0].othersMean).toBeNull()
  })
})

describe("aggregateThreeSixty — gap + quadrants", () => {
  it("excludes below-threshold anonymous raters from othersMean (anonymity)", () => {
    // manager (named) + 1 peer (suppressed): othersMean must be the manager
    // alone, so the lone peer's score can't be recovered from the aggregate.
    const agg = aggregateThreeSixty(
      [self(80), obs("manager", 60), obs("peer", 40)],
      [F],
    )
    const f = agg.factors[0]
    expect(f.othersMean).toBeCloseTo(60)
    expect(f.gap).toBeCloseTo(20)
  })

  it("includes an anonymous category in othersMean once it meets threshold", () => {
    const agg = aggregateThreeSixty(
      [
        self(80),
        obs("manager", 60),
        obs("peer", 30),
        obs("peer", 30),
        obs("peer", 30),
      ],
      [F],
    )
    // manager 60 + three peers at 30 → (60+30+30+30)/4 = 37.5
    expect(agg.factors[0].othersMean).toBeCloseTo(37.5)
  })

  it("flags a blind spot when self is high but others are low", () => {
    const agg = aggregateThreeSixty(
      [self(85), obs("manager", 30), obs("peer", 35)],
      [F],
    )
    expect(agg.factors[0].quadrant).toBe("blind_spot")
  })

  it("flags a hidden strength when others rate higher than self", () => {
    const agg = aggregateThreeSixty(
      [self(30), obs("manager", 80), obs("peer", 85)],
      [F],
    )
    expect(agg.factors[0].quadrant).toBe("hidden_strength")
  })

  it("flags a confirmed strength when self and others are both high", () => {
    const agg = aggregateThreeSixty(
      [self(80), obs("manager", 75)],
      [F],
    )
    expect(agg.factors[0].quadrant).toBe("confirmed_strength")
  })

  it("returns insufficient_data when there are no observers", () => {
    const agg = aggregateThreeSixty([self(80)], [F])
    expect(agg.factors[0].quadrant).toBe("insufficient_data")
    expect(agg.factors[0].othersMean).toBeNull()
    expect(agg.factors[0].gap).toBeNull()
  })
})

describe("aggregateThreeSixty — counts", () => {
  it("counts observers by category and excludes self", () => {
    const agg = aggregateThreeSixty(
      [self(70), obs("manager", 60), obs("peer", 50), obs("peer", 55)],
      [F],
    )
    expect(agg.raterCount).toBe(3)
    expect(agg.raterCountByCategory).toEqual({ manager: 1, peer: 2 })
  })
})
