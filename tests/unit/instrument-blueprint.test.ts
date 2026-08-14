import { describe, expect, it } from "vitest";
import {
  totalTargetItems,
  facetCount,
  intensitySpread,
  auditCoverage,
  estimateBurdenSeconds,
  validateBlueprint,
  allocateTargets,
  DEFAULT_SECONDS_PER_ITEM,
} from "@/lib/instrument/blueprint";
import type { BlueprintCell } from "@/lib/instrument/types";

describe("blueprint module", () => {
  describe("totalTargetItems", () => {
    it("returns 0 for empty cells array", () => {
      expect(totalTargetItems([])).toBe(0);
    });

    it("sums targetItemCount across all cells", () => {
      const cells: BlueprintCell[] = [
        { id: "1", facetLabel: "A", intensity: "low", targetItemCount: 3, displayOrder: 0 },
        { id: "2", facetLabel: "B", intensity: "high", targetItemCount: 5, displayOrder: 1 },
      ];
      expect(totalTargetItems(cells)).toBe(8);
    });
  });

  describe("facetCount", () => {
    it("returns 0 for empty cells", () => {
      expect(facetCount([])).toBe(0);
    });

    it("counts distinct facet labels", () => {
      const cells: BlueprintCell[] = [
        { id: "1", facetLabel: "Communication", intensity: "low", targetItemCount: 2, displayOrder: 0 },
        { id: "2", facetLabel: "Communication", intensity: "high", targetItemCount: 2, displayOrder: 1 },
        { id: "3", facetLabel: "Leadership", intensity: "mid", targetItemCount: 3, displayOrder: 2 },
      ];
      expect(facetCount(cells)).toBe(2);
    });
  });

  describe("intensitySpread", () => {
    it("returns zero spread for empty cells", () => {
      expect(intensitySpread([])).toEqual({ low: 0, mid: 0, high: 0 });
    });

    it("counts items per intensity level", () => {
      const cells: BlueprintCell[] = [
        { id: "1", facetLabel: "A", intensity: "low", targetItemCount: 2, displayOrder: 0 },
        { id: "2", facetLabel: "B", intensity: "low", targetItemCount: 3, displayOrder: 1 },
        { id: "3", facetLabel: "C", intensity: "high", targetItemCount: 4, displayOrder: 2 },
      ];
      expect(intensitySpread(cells)).toEqual({ low: 5, mid: 0, high: 4 });
    });
  });

  describe("auditCoverage", () => {
    it("reports all empty cells", () => {
      const cells: BlueprintCell[] = [
        { id: "cell1", facetLabel: "A", intensity: "low", targetItemCount: 3, displayOrder: 0 },
        { id: "cell2", facetLabel: "B", intensity: "high", targetItemCount: 2, displayOrder: 1 },
      ];
      const items: Array<{ id: string; blueprintCellId?: string | null }> = [];
      const report = auditCoverage(cells, items);

      expect(report.emptyCells).toBe(2);
      expect(report.underfilledCells).toBe(0);
      expect(report.isComplete).toBe(false);
      expect(report.totalTarget).toBe(5);
      expect(report.totalActual).toBe(0);
      expect(report.cells.every(c => c.status === "empty")).toBe(true);
    });

    it("reports under-filled cells", () => {
      const cells: BlueprintCell[] = [
        { id: "cell1", facetLabel: "A", intensity: "low", targetItemCount: 5, displayOrder: 0 },
      ];
      const items: Array<{ id: string; blueprintCellId?: string | null }> = [
        { id: "item1", blueprintCellId: "cell1" },
        { id: "item2", blueprintCellId: "cell1" },
      ];
      const report = auditCoverage(cells, items);

      expect(report.cells[0].status).toBe("under");
      expect(report.cells[0].actual).toBe(2);
      expect(report.cells[0].deficit).toBe(3);
      expect(report.cells[0].surplus).toBe(0);
    });

    it("reports met and over-filled cells", () => {
      const cells: BlueprintCell[] = [
        { id: "cell1", facetLabel: "A", intensity: "low", targetItemCount: 3, displayOrder: 0 },
        { id: "cell2", facetLabel: "B", intensity: "high", targetItemCount: 2, displayOrder: 1 },
      ];
      const items: Array<{ id: string; blueprintCellId?: string | null }> = [
        { id: "item1", blueprintCellId: "cell1" },
        { id: "item2", blueprintCellId: "cell1" },
        { id: "item3", blueprintCellId: "cell1" },
        { id: "item4", blueprintCellId: "cell2" },
        { id: "item5", blueprintCellId: "cell2" },
        { id: "item6", blueprintCellId: "cell2" },
      ];
      const report = auditCoverage(cells, items);

      expect(report.cells[0].status).toBe("met");
      expect(report.cells[0].surplus).toBe(0);
      expect(report.cells[1].status).toBe("over");
      expect(report.cells[1].surplus).toBe(1);
    });

    it("counts unassigned items", () => {
      const cells: BlueprintCell[] = [
        { id: "cell1", facetLabel: "A", intensity: "low", targetItemCount: 2, displayOrder: 0 },
      ];
      const items: Array<{ id: string; blueprintCellId?: string | null }> = [
        { id: "item1", blueprintCellId: "cell1" },
        { id: "item2", blueprintCellId: null },
        { id: "item3" },
      ];
      const report = auditCoverage(cells, items);

      expect(report.unassignedItemCount).toBe(2);
      expect(report.totalActual).toBe(1);
    });

    it("reports isComplete when all cells are met or over", () => {
      const cells: BlueprintCell[] = [
        { id: "cell1", facetLabel: "A", intensity: "low", targetItemCount: 2, displayOrder: 0 },
        { id: "cell2", facetLabel: "B", intensity: "high", targetItemCount: 2, displayOrder: 1 },
      ];
      const items: Array<{ id: string; blueprintCellId?: string | null }> = [
        { id: "item1", blueprintCellId: "cell1" },
        { id: "item2", blueprintCellId: "cell1" },
        { id: "item3", blueprintCellId: "cell2" },
        { id: "item4", blueprintCellId: "cell2" },
      ];
      const report = auditCoverage(cells, items);

      expect(report.isComplete).toBe(true);
      expect(report.emptyCells).toBe(0);
      expect(report.underfilledCells).toBe(0);
    });
  });

  describe("estimateBurdenSeconds", () => {
    it("uses default seconds per item", () => {
      const secs = estimateBurdenSeconds(10);
      expect(secs).toBe(10 * DEFAULT_SECONDS_PER_ITEM);
    });

    it("respects custom seconds per item", () => {
      expect(estimateBurdenSeconds(5, 8)).toBe(40);
    });

    it("handles 0 items", () => {
      expect(estimateBurdenSeconds(0)).toBe(0);
    });
  });

  describe("validateBlueprint", () => {
    it("passes valid blueprint", () => {
      const cells: BlueprintCell[] = [
        { id: "1", facetLabel: "Leadership", intensity: "low", targetItemCount: 3, displayOrder: 0 },
        { id: "2", facetLabel: "Leadership", intensity: "high", targetItemCount: 3, displayOrder: 1 },
      ];
      const result = validateBlueprint(cells);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("errors on empty cells array", () => {
      const result = validateBlueprint([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Blueprint has no cells");
    });

    it("errors on empty facet label", () => {
      const cells: BlueprintCell[] = [
        { id: "1", facetLabel: "", intensity: "low", targetItemCount: 2, displayOrder: 0 },
      ];
      const result = validateBlueprint(cells);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("empty facetLabel"))).toBe(true);
    });

    it("errors on targetItemCount < 1", () => {
      const cells: BlueprintCell[] = [
        { id: "1", facetLabel: "A", intensity: "low", targetItemCount: 0, displayOrder: 0 },
      ];
      const result = validateBlueprint(cells);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("targetItemCount < 1"))).toBe(true);
    });

    it("errors on duplicate facet+intensity pairs", () => {
      const cells: BlueprintCell[] = [
        { id: "1", facetLabel: "A", intensity: "low", targetItemCount: 2, displayOrder: 0 },
        { id: "2", facetLabel: "A", intensity: "low", targetItemCount: 3, displayOrder: 1 },
      ];
      const result = validateBlueprint(cells);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Duplicate blueprint cell"))).toBe(true);
    });

    it("warns on single intensity per facet", () => {
      const cells: BlueprintCell[] = [
        { id: "1", facetLabel: "A", intensity: "low", targetItemCount: 2, displayOrder: 0 },
        { id: "2", facetLabel: "B", intensity: "low", targetItemCount: 2, displayOrder: 1 },
        { id: "3", facetLabel: "B", intensity: "high", targetItemCount: 2, displayOrder: 2 },
      ];
      const result = validateBlueprint(cells);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes("only one intensity level"))).toBe(true);
    });

    it("warns on total < 4 items", () => {
      const cells: BlueprintCell[] = [
        { id: "1", facetLabel: "A", intensity: "low", targetItemCount: 3, displayOrder: 0 },
      ];
      const result = validateBlueprint(cells);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes("less than 4"))).toBe(true);
    });

    it("warns on > 8 facets", () => {
      const cells: BlueprintCell[] = Array.from({ length: 9 }, (_, i) => ({
        id: String(i),
        facetLabel: `Facet${i}`,
        intensity: "low" as const,
        targetItemCount: 1,
        displayOrder: i,
      }));
      const result = validateBlueprint(cells);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes("too broad"))).toBe(true);
    });

    it("warns on total > 30 items", () => {
      const cells: BlueprintCell[] = [
        { id: "1", facetLabel: "A", intensity: "low", targetItemCount: 35, displayOrder: 0 },
      ];
      const result = validateBlueprint(cells);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes("exceeds 30"))).toBe(true);
    });
  });

  describe("allocateTargets", () => {
    it("returns empty array for empty cells", () => {
      expect(allocateTargets(10, [])).toEqual([]);
    });

    it("distributes proportionally", () => {
      const cells: BlueprintCell[] = [
        { id: "1", facetLabel: "A", intensity: "low", targetItemCount: 1, displayOrder: 0 },
        { id: "2", facetLabel: "B", intensity: "high", targetItemCount: 1, displayOrder: 1 },
      ];
      const result = allocateTargets(10, cells);
      expect(result.reduce((sum, c) => sum + c.targetItemCount, 0)).toBe(10);
      expect(result.every(c => c.targetItemCount >= 1)).toBe(true);
    });

    it("distributes remainder to earliest displayOrder", () => {
      const cells: BlueprintCell[] = [
        { id: "1", facetLabel: "A", intensity: "low", targetItemCount: 1, displayOrder: 0 },
        { id: "2", facetLabel: "B", intensity: "mid", targetItemCount: 1, displayOrder: 1 },
        { id: "3", facetLabel: "C", intensity: "high", targetItemCount: 1, displayOrder: 2 },
      ];
      const result = allocateTargets(10, cells);

      // Total should be 10
      expect(result.reduce((sum, c) => sum + c.targetItemCount, 0)).toBe(10);

      // Result should all have >= 1
      expect(result.every(c => c.targetItemCount >= 1)).toBe(true);

      // First cell (displayOrder 0) should have most
      const sorted = result.sort((a, b) => {
        const aOrig = cells.find(c => c.id === a.id)!;
        const bOrig = cells.find(c => c.id === b.id)!;
        return aOrig.displayOrder - bOrig.displayOrder;
      });
      expect(sorted[0].targetItemCount).toBeGreaterThanOrEqual(sorted[1].targetItemCount);
    });

    it("ensures no cell gets 0 items", () => {
      const cells: BlueprintCell[] = [
        { id: "1", facetLabel: "A", intensity: "low", targetItemCount: 2, displayOrder: 0 },
        { id: "2", facetLabel: "B", intensity: "high", targetItemCount: 2, displayOrder: 1 },
      ];
      const result = allocateTargets(5, cells);
      expect(result.every(c => c.targetItemCount >= 1)).toBe(true);
    });

    it("handles totalItems < cells.length gracefully", () => {
      const cells: BlueprintCell[] = [
        { id: "1", facetLabel: "A", intensity: "low", targetItemCount: 3, displayOrder: 0 },
        { id: "2", facetLabel: "B", intensity: "high", targetItemCount: 3, displayOrder: 1 },
      ];
      const result = allocateTargets(1, cells);
      expect(result).toEqual(cells);
    });

    it("allocates exactly the requested total", () => {
      const cells: BlueprintCell[] = [
        { id: "1", facetLabel: "A", intensity: "low", targetItemCount: 3, displayOrder: 0 },
        { id: "2", facetLabel: "B", intensity: "mid", targetItemCount: 3, displayOrder: 1 },
        { id: "3", facetLabel: "C", intensity: "high", targetItemCount: 3, displayOrder: 2 },
      ];
      const result = allocateTargets(10, cells);
      expect(result.reduce((sum, c) => sum + c.targetItemCount, 0)).toBe(10);
    });
  });
});
