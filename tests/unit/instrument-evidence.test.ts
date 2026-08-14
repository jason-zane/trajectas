import { describe, expect, it } from "vitest";
import {
  EVIDENCE_CLASS_RANK,
  isSupersededBy,
  resolveCurrentEvidence,
  formatEvidenceLabel,
  describeConfidence,
} from "@/lib/instrument/evidence";
import type { EvidenceRecord } from "@/lib/instrument/types";

describe("evidence module", () => {
  describe("EVIDENCE_CLASS_RANK", () => {
    it("assigns correct ranks", () => {
      expect(EVIDENCE_CLASS_RANK.a_priori).toBe(0);
      expect(EVIDENCE_CLASS_RANK.synthetic).toBe(1);
      expect(EVIDENCE_CLASS_RANK.empirical).toBe(2);
    });
  });

  describe("isSupersededBy", () => {
    it("returns false for different targets", () => {
      const existing: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "a_priori",
        producedAt: new Date("2026-01-01"),
      };
      const incoming: EvidenceRecord = {
        id: "2",
        targetType: "item",
        targetId: "item2",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "empirical",
        producedAt: new Date("2026-01-02"),
      };
      expect(isSupersededBy(existing, incoming)).toBe(false);
    });

    it("returns false for different claims", () => {
      const existing: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "a_priori",
        producedAt: new Date("2026-01-01"),
      };
      const incoming: EvidenceRecord = {
        id: "2",
        targetType: "item",
        targetId: "item1",
        claim: "discrimination",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "empirical",
        producedAt: new Date("2026-01-02"),
      };
      expect(isSupersededBy(existing, incoming)).toBe(false);
    });

    it("supersedes a_priori with synthetic", () => {
      const existing: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "a_priori",
        producedAt: new Date("2026-01-01"),
      };
      const incoming: EvidenceRecord = {
        id: "2",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "synthetic",
        producedAt: new Date("2026-01-02"),
      };
      expect(isSupersededBy(existing, incoming)).toBe(true);
    });

    it("supersedes synthetic with empirical", () => {
      const existing: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "synthetic",
        producedAt: new Date("2026-01-01"),
      };
      const incoming: EvidenceRecord = {
        id: "2",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "empirical",
        producedAt: new Date("2026-01-02"),
      };
      expect(isSupersededBy(existing, incoming)).toBe(true);
    });

    it("returns false when incoming has lower class", () => {
      const existing: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "empirical",
        producedAt: new Date("2026-01-01"),
      };
      const incoming: EvidenceRecord = {
        id: "2",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "a_priori",
        producedAt: new Date("2026-01-02"),
      };
      expect(isSupersededBy(existing, incoming)).toBe(false);
    });

    it("uses date when same evidence class", () => {
      const existing: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "synthetic",
        producedAt: new Date("2026-01-01"),
      };
      const incoming: EvidenceRecord = {
        id: "2",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "synthetic",
        producedAt: new Date("2026-01-02"),
      };
      expect(isSupersededBy(existing, incoming)).toBe(true);
    });

    it("returns false when incoming is older with same class", () => {
      const existing: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "synthetic",
        producedAt: new Date("2026-01-02"),
      };
      const incoming: EvidenceRecord = {
        id: "2",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "synthetic",
        producedAt: new Date("2026-01-01"),
      };
      expect(isSupersededBy(existing, incoming)).toBe(false);
    });
  });

  describe("resolveCurrentEvidence", () => {
    it("returns single record when no duplicates", () => {
      const records: EvidenceRecord[] = [
        {
          id: "1",
          targetType: "item",
          targetId: "item1",
          claim: "difficulty",
          value: 0.5,
          method: "test_fixture",
          evidenceClass: "a_priori",
          producedAt: new Date("2026-01-01"),
        },
      ];
      const result = resolveCurrentEvidence(records);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("selects highest evidence class", () => {
      const records: EvidenceRecord[] = [
        {
          id: "1",
          targetType: "item",
          targetId: "item1",
          claim: "difficulty",
          value: 0.5,
          method: "test_fixture",
          evidenceClass: "a_priori",
          producedAt: new Date("2026-01-01"),
        },
        {
          id: "2",
          targetType: "item",
          targetId: "item1",
          claim: "difficulty",
          value: 0.5,
          method: "test_fixture",
          evidenceClass: "empirical",
          producedAt: new Date("2026-01-02"),
        },
      ];
      const result = resolveCurrentEvidence(records);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("2");
      expect(result[0].evidenceClass).toBe("empirical");
    });

    it("selects newest when same evidence class", () => {
      const records: EvidenceRecord[] = [
        {
          id: "1",
          targetType: "item",
          targetId: "item1",
          claim: "difficulty",
          value: 0.5,
          method: "test_fixture",
          evidenceClass: "synthetic",
          producedAt: new Date("2026-01-01"),
        },
        {
          id: "2",
          targetType: "item",
          targetId: "item1",
          claim: "difficulty",
          value: 0.5,
          method: "test_fixture",
          evidenceClass: "synthetic",
          producedAt: new Date("2026-01-03"),
        },
        {
          id: "3",
          targetType: "item",
          targetId: "item1",
          claim: "difficulty",
          value: 0.5,
          method: "test_fixture",
          evidenceClass: "synthetic",
          producedAt: new Date("2026-01-02"),
        },
      ];
      const result = resolveCurrentEvidence(records);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("2");
    });

    it("keeps separate records for different targets", () => {
      const records: EvidenceRecord[] = [
        {
          id: "1",
          targetType: "item",
          targetId: "item1",
          claim: "difficulty",
          value: 0.5,
          method: "test_fixture",
          evidenceClass: "a_priori",
          producedAt: new Date("2026-01-01"),
        },
        {
          id: "2",
          targetType: "item",
          targetId: "item2",
          claim: "difficulty",
          value: 0.5,
          method: "test_fixture",
          evidenceClass: "a_priori",
          producedAt: new Date("2026-01-01"),
        },
      ];
      const result = resolveCurrentEvidence(records);
      expect(result).toHaveLength(2);
    });

    it("keeps separate records for different claims", () => {
      const records: EvidenceRecord[] = [
        {
          id: "1",
          targetType: "item",
          targetId: "item1",
          claim: "difficulty",
          value: 0.5,
          method: "test_fixture",
          evidenceClass: "a_priori",
          producedAt: new Date("2026-01-01"),
        },
        {
          id: "2",
          targetType: "item",
          targetId: "item1",
          claim: "discrimination",
          value: 0.5,
          method: "test_fixture",
          evidenceClass: "a_priori",
          producedAt: new Date("2026-01-01"),
        },
      ];
      const result = resolveCurrentEvidence(records);
      expect(result).toHaveLength(2);
    });

    it("keeps separate records for different target types", () => {
      const records: EvidenceRecord[] = [
        {
          id: "1",
          targetType: "item",
          targetId: "item1",
          claim: "difficulty",
          value: 0.5,
          method: "test_fixture",
          evidenceClass: "a_priori",
          producedAt: new Date("2026-01-01"),
        },
        {
          id: "2",
          targetType: "construct",
          targetId: "item1",
          claim: "difficulty",
          value: 0.5,
          method: "test_fixture",
          evidenceClass: "a_priori",
          producedAt: new Date("2026-01-01"),
        },
      ];
      const result = resolveCurrentEvidence(records);
      expect(result).toHaveLength(2);
    });

    it("selects empirical over synthetic over a_priori in multi-class scenario", () => {
      const records: EvidenceRecord[] = [
        {
          id: "1",
          targetType: "item",
          targetId: "item1",
          claim: "difficulty",
          value: 0.5,
          method: "test_fixture",
          evidenceClass: "a_priori",
          producedAt: new Date("2026-01-01"),
        },
        {
          id: "2",
          targetType: "item",
          targetId: "item1",
          claim: "difficulty",
          value: 0.5,
          method: "test_fixture",
          evidenceClass: "synthetic",
          producedAt: new Date("2026-01-02"),
        },
        {
          id: "3",
          targetType: "item",
          targetId: "item1",
          claim: "difficulty",
          value: 0.5,
          method: "test_fixture",
          evidenceClass: "empirical",
          producedAt: new Date("2026-01-01"),
        },
      ];
      const result = resolveCurrentEvidence(records);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("3");
      expect(result[0].evidenceClass).toBe("empirical");
    });
  });

  describe("formatEvidenceLabel", () => {
    it("formats a_priori as 'forecast (no data)'", () => {
      const record: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "a_priori",
        producedAt: new Date(),
      };
      expect(formatEvidenceLabel(record)).toBe("forecast (no data)");
    });

    it("formats synthetic with n", () => {
      const record: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "synthetic",
        detail: { n: 50 },
        producedAt: new Date(),
      };
      expect(formatEvidenceLabel(record)).toBe("simulated (n=50)");
    });

    it("formats synthetic without n", () => {
      const record: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "synthetic",
        producedAt: new Date(),
      };
      expect(formatEvidenceLabel(record)).toBe("simulated (n=?)");
    });

    it("formats empirical with n", () => {
      const record: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "empirical",
        detail: { n: 142 },
        producedAt: new Date(),
      };
      expect(formatEvidenceLabel(record)).toBe("observed (n=142)");
    });

    it("formats empirical without n", () => {
      const record: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "empirical",
        producedAt: new Date(),
      };
      expect(formatEvidenceLabel(record)).toBe("observed");
    });
  });

  describe("describeConfidence", () => {
    it("returns 'none' for a_priori", () => {
      const record: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "a_priori",
        producedAt: new Date(),
      };
      expect(describeConfidence(record)).toBe("none");
    });

    it("returns 'low' for synthetic", () => {
      const record: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "synthetic",
        producedAt: new Date(),
      };
      expect(describeConfidence(record)).toBe("low");
    });

    it("returns 'low' for empirical with n < 50", () => {
      const record: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "empirical",
        detail: { n: 30 },
        producedAt: new Date(),
      };
      expect(describeConfidence(record)).toBe("low");
    });

    it("returns 'low' for empirical with n = 49", () => {
      const record: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "empirical",
        detail: { n: 49 },
        producedAt: new Date(),
      };
      expect(describeConfidence(record)).toBe("low");
    });

    it("returns 'moderate' for empirical with 50 <= n < 150", () => {
      const record: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "empirical",
        detail: { n: 100 },
        producedAt: new Date(),
      };
      expect(describeConfidence(record)).toBe("moderate");
    });

    it("returns 'moderate' for empirical with n = 50", () => {
      const record: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "empirical",
        detail: { n: 50 },
        producedAt: new Date(),
      };
      expect(describeConfidence(record)).toBe("moderate");
    });

    it("returns 'moderate' for empirical with n = 149", () => {
      const record: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "empirical",
        detail: { n: 149 },
        producedAt: new Date(),
      };
      expect(describeConfidence(record)).toBe("moderate");
    });

    it("returns 'high' for empirical with n >= 150", () => {
      const record: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "empirical",
        detail: { n: 200 },
        producedAt: new Date(),
      };
      expect(describeConfidence(record)).toBe("high");
    });

    it("returns 'high' for empirical with n = 150", () => {
      const record: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "empirical",
        detail: { n: 150 },
        producedAt: new Date(),
      };
      expect(describeConfidence(record)).toBe("high");
    });

    it("treats missing n as 0 (low confidence)", () => {
      const record: EvidenceRecord = {
        id: "1",
        targetType: "item",
        targetId: "item1",
        claim: "difficulty",
        value: 0.5,
        method: "test_fixture",
        evidenceClass: "empirical",
        producedAt: new Date(),
      };
      expect(describeConfidence(record)).toBe("low");
    });
  });
});
