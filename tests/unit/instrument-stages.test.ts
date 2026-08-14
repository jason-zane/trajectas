/**
 * Comprehensive test suite for the instrument builder stage graph.
 *
 * Tests the registry (topological sort, cycle detection, validation) and
 * the runner (sequential execution, error handling, output accumulation).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createRegistry,
  validateRegistry,
  resolveOrder,
} from "@/lib/instrument/stages/registry";
import { runGraph } from "@/lib/instrument/stages/runner";
import type {
  StageDefinition,
  StageKey,
  StageOutcome,
} from "@/lib/instrument/stages/types";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock stage definition for testing.
 */
function mockStage(overrides: Partial<StageDefinition>): StageDefinition {
  return {
    key: "blueprint_draft" as StageKey,
    requires: [],
    severity: "blocking",
    run: vi.fn(async () => ({})),
    ...overrides,
  };
}

// ============================================================================
// Registry Tests
// ============================================================================

describe("instrument stages: registry", () => {
  describe("validateRegistry", () => {
    it("returns valid=true for well-formed definitions", () => {
      const defs = [
        mockStage({ key: "blueprint_draft" as StageKey, requires: [] }),
        mockStage({
          key: "item_generation" as StageKey,
          requires: ["blueprint_draft" as StageKey],
        }),
      ];

      const result = validateRegistry(defs);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("detects duplicate stage keys", () => {
      const defs = [
        mockStage({ key: "blueprint_draft" as StageKey }),
        mockStage({ key: "blueprint_draft" as StageKey }),
      ];

      const result = validateRegistry(defs);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining("Duplicate stage key")
      );
    });

    it("detects unknown dependencies", () => {
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          requires: ["nonexistent" as StageKey],
        }),
      ];

      const result = validateRegistry(defs);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining("requires unknown stage")
      );
    });

    it("detects simple cycles", () => {
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          requires: ["item_generation" as StageKey],
        }),
        mockStage({
          key: "item_generation" as StageKey,
          requires: ["blueprint_draft" as StageKey],
        }),
      ];

      const result = validateRegistry(defs);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining("Circular dependency")
      );
    });

    it("detects self-loops", () => {
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          requires: ["blueprint_draft" as StageKey],
        }),
      ];

      const result = validateRegistry(defs);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining("Circular dependency")
      );
    });

    it("detects longer cycles", () => {
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          requires: ["item_generation" as StageKey],
        }),
        mockStage({
          key: "item_generation" as StageKey,
          requires: ["congruence_panel" as StageKey],
        }),
        mockStage({
          key: "congruence_panel" as StageKey,
          requires: ["blueprint_draft" as StageKey],
        }),
      ];

      const result = validateRegistry(defs);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("createRegistry", () => {
    it("throws on invalid definitions", () => {
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          requires: ["nonexistent" as StageKey],
        }),
      ];

      expect(() => createRegistry(defs)).toThrow("Invalid stage registry");
    });

    it("creates a registry from valid definitions", () => {
      const defs = [mockStage({ key: "blueprint_draft" as StageKey })];
      const registry = createRegistry(defs);

      expect(registry.get("blueprint_draft")).toBeDefined();
      expect(registry.all()).toHaveLength(1);
    });
  });

  describe("resolveOrder", () => {
    it("includes transitive dependencies", () => {
      const defs = [
        mockStage({ key: "blueprint_draft" as StageKey, requires: [] }),
        mockStage({
          key: "item_generation" as StageKey,
          requires: ["blueprint_draft" as StageKey],
        }),
        mockStage({
          key: "congruence_panel" as StageKey,
          requires: ["item_generation" as StageKey],
        }),
      ];

      const order = resolveOrder(defs, ["congruence_panel" as StageKey]);
      expect(order).toEqual([
        "blueprint_draft",
        "item_generation",
        "congruence_panel",
      ]);
    });

    it("respects direct dependencies", () => {
      const defs = [
        mockStage({ key: "blueprint_draft" as StageKey, requires: [] }),
        mockStage({
          key: "item_generation" as StageKey,
          requires: ["blueprint_draft" as StageKey],
        }),
      ];

      const order = resolveOrder(defs, ["item_generation" as StageKey]);
      expect(order[0]).toBe("blueprint_draft");
      expect(order[1]).toBe("item_generation");
    });

    it("uses registration order for tie-breaking (deterministic)", () => {
      // Two independent stages with no ordering constraint between them
      const defs = [
        mockStage({ key: "blueprint_draft" as StageKey, requires: [] }),
        mockStage({ key: "item_generation" as StageKey, requires: [] }),
      ];

      // Request both; should return in registration order
      const order1 = resolveOrder(defs, [
        "blueprint_draft" as StageKey,
        "item_generation" as StageKey,
      ]);
      expect(order1).toEqual(["blueprint_draft", "item_generation"]);

      // Request in reverse order; should still return in registration order
      const order2 = resolveOrder(defs, [
        "item_generation" as StageKey,
        "blueprint_draft" as StageKey,
      ]);
      expect(order2).toEqual(["blueprint_draft", "item_generation"]);
    });

    it("throws on unknown stage", () => {
      const defs = [mockStage({ key: "blueprint_draft" as StageKey })];

      expect(() =>
        resolveOrder(defs, ["nonexistent" as StageKey])
      ).toThrow("Requested unknown stage");
    });

    it("throws on circular dependency", () => {
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          requires: ["item_generation" as StageKey],
        }),
        mockStage({
          key: "item_generation" as StageKey,
          requires: ["blueprint_draft" as StageKey],
        }),
      ];

      expect(() =>
        resolveOrder(defs, ["blueprint_draft" as StageKey])
      ).toThrow();
    });

    it("handles empty request", () => {
      const defs = [mockStage({ key: "blueprint_draft" as StageKey })];
      const order = resolveOrder(defs, []);
      expect(order).toEqual([]);
    });

    it("deduplicates transitive dependencies", () => {
      // blueprint_draft <- item_generation
      // blueprint_draft <- congruence_panel
      // Request both; blueprint_draft should appear once
      const defs = [
        mockStage({ key: "blueprint_draft" as StageKey, requires: [] }),
        mockStage({
          key: "item_generation" as StageKey,
          requires: ["blueprint_draft" as StageKey],
        }),
        mockStage({
          key: "congruence_panel" as StageKey,
          requires: ["blueprint_draft" as StageKey],
        }),
      ];

      const order = resolveOrder(defs, [
        "item_generation" as StageKey,
        "congruence_panel" as StageKey,
      ]);
      expect(order.filter((k) => k === "blueprint_draft")).toHaveLength(1);
    });

    it("returns stages in dependency order (dependencies first)", () => {
      const defs = [
        mockStage({ key: "reliability_forecast" as StageKey, requires: [] }),
        mockStage({
          key: "coverage_audit" as StageKey,
          requires: ["reliability_forecast" as StageKey],
        }),
        mockStage({
          key: "publish_readiness" as StageKey,
          requires: ["coverage_audit" as StageKey],
        }),
      ];

      const order = resolveOrder(defs, ["publish_readiness" as StageKey]);
      expect(order).toEqual([
        "reliability_forecast",
        "coverage_audit",
        "publish_readiness",
      ]);
    });
  });
});

// ============================================================================
// Runner Tests
// ============================================================================

describe("instrument stages: runner", () => {
  describe("runGraph", () => {
    let mockClock: () => number;
    let clockValue: number;

    beforeEach(() => {
      clockValue = 1000; // Start at 1000ms since epoch
      mockClock = vi.fn(() => clockValue);
    });

    it("executes stages in order", async () => {
      const runOrder: string[] = [];
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          requires: [],
          run: vi.fn(async () => {
            runOrder.push("blueprint_draft");
            return {};
          }),
        }),
        mockStage({
          key: "item_generation" as StageKey,
          requires: ["blueprint_draft" as StageKey],
          run: vi.fn(async () => {
            runOrder.push("item_generation");
            return {};
          }),
        }),
      ];

      const registry = createRegistry(defs);
      const onOutcome = vi.fn<(outcome: StageOutcome) => Promise<void>>(async () => {});

      await runGraph(
        registry,
        ["item_generation" as StageKey],
        {},
        { onOutcome, now: mockClock }
      );

      expect(runOrder).toEqual(["blueprint_draft", "item_generation"]);
    });

    it("accumulates output from each stage", async () => {
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          run: vi.fn(async () => ({ blueprintId: "bp-123" })),
        }),
        mockStage({
          key: "item_generation" as StageKey,
          requires: ["blueprint_draft" as StageKey],
          run: vi.fn(async (ctx, input) => {
            // Verify accumulated input is available
            expect(input).toHaveProperty("blueprintId", "bp-123");
            return { itemCount: 50 };
          }),
        }),
      ];

      const registry = createRegistry(defs);
      const onOutcome = vi.fn<(outcome: StageOutcome) => Promise<void>>(async () => {});

      const result = await runGraph(
        registry,
        ["item_generation" as StageKey],
        {},
        { onOutcome, now: mockClock }
      );

      expect(result.ok).toBe(true);
    });

    it("calls onOutcome once per stage in execution order", async () => {
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          run: vi.fn(async () => ({})),
        }),
        mockStage({
          key: "item_generation" as StageKey,
          requires: ["blueprint_draft" as StageKey],
          run: vi.fn(async () => ({})),
        }),
      ];

      const registry = createRegistry(defs);
      const onOutcome = vi.fn<(outcome: StageOutcome) => Promise<void>>(async () => {});

      await runGraph(
        registry,
        ["item_generation" as StageKey],
        {},
        { onOutcome, now: mockClock }
      );

      expect(onOutcome).toHaveBeenCalledTimes(2);
      const outcomes = onOutcome.mock.calls.map((call) => call[0] as StageOutcome);
      expect(outcomes[0].key).toBe("blueprint_draft");
      expect(outcomes[1].key).toBe("item_generation");
    });

    it("records success status for completed stages", async () => {
      const defs = [mockStage({ key: "blueprint_draft" as StageKey })];

      const registry = createRegistry(defs);
      const outcomes: StageOutcome[] = [];
      const onOutcome = vi.fn(async (outcome) => {
        outcomes.push(outcome);
      });

      const result = await runGraph(
        registry,
        ["blueprint_draft" as StageKey],
        {},
        { onOutcome, now: mockClock }
      );

      expect(result.ok).toBe(true);
      expect(outcomes[0].status).toBe("success");
      expect(result.completed).toContain("blueprint_draft");
      expect(result.failed).toHaveLength(0);
    });

    it("records failure status and error message", async () => {
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          run: vi.fn(async () => {
            throw new Error("Test error");
          }),
        }),
      ];

      const registry = createRegistry(defs);
      const outcomes: StageOutcome[] = [];
      const onOutcome = vi.fn(async (outcome) => {
        outcomes.push(outcome);
      });

      const result = await runGraph(
        registry,
        ["blueprint_draft" as StageKey],
        {},
        { onOutcome, now: mockClock }
      );

      expect(result.ok).toBe(false);
      expect(outcomes[0].status).toBe("failure");
      expect(outcomes[0].error).toContain("Test error");
      expect(result.failed).toContain("blueprint_draft");
    });

    it("stops on blocking stage failure", async () => {
      const runOrder: string[] = [];
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          severity: "blocking",
          run: vi.fn(async () => {
            runOrder.push("blueprint_draft");
            throw new Error("Blocking failure");
          }),
        }),
        mockStage({
          key: "item_generation" as StageKey,
          requires: ["blueprint_draft" as StageKey],
          severity: "blocking",
          run: vi.fn(async () => {
            runOrder.push("item_generation");
            return {};
          }),
        }),
      ];

      const registry = createRegistry(defs);
      const onOutcome = vi.fn<(outcome: StageOutcome) => Promise<void>>(async () => {});

      const result = await runGraph(
        registry,
        ["item_generation" as StageKey],
        {},
        { onOutcome, now: mockClock }
      );

      expect(runOrder).toEqual(["blueprint_draft"]);
      expect(result.skipped).toContain("item_generation");
      expect(result.completed).toHaveLength(0);
    });

    it("continues on advisory stage failure", async () => {
      const runOrder: string[] = [];
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          severity: "advisory",
          run: vi.fn(async () => {
            runOrder.push("blueprint_draft");
            throw new Error("Advisory failure");
          }),
        }),
        mockStage({
          key: "item_generation" as StageKey,
          requires: ["blueprint_draft" as StageKey],
          severity: "blocking",
          run: vi.fn(async () => {
            runOrder.push("item_generation");
            return {};
          }),
        }),
      ];

      const registry = createRegistry(defs);
      const onOutcome = vi.fn<(outcome: StageOutcome) => Promise<void>>(async () => {});

      const result = await runGraph(
        registry,
        ["item_generation" as StageKey],
        {},
        { onOutcome, now: mockClock }
      );

      expect(runOrder).toContain("blueprint_draft");
      expect(runOrder).toContain("item_generation");
      expect(result.completed).toContain("item_generation");
      expect(result.failed).toContain("blueprint_draft");
      expect(result.ok).toBe(false); // ok is false because a stage failed
    });

    it("marks remaining stages skipped after blocking failure", async () => {
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          severity: "blocking",
          run: vi.fn(async () => {
            throw new Error("Blocking failure");
          }),
        }),
        mockStage({
          key: "item_generation" as StageKey,
          requires: ["blueprint_draft" as StageKey],
          severity: "blocking",
        }),
        mockStage({
          key: "congruence_panel" as StageKey,
          requires: ["item_generation" as StageKey],
          severity: "blocking",
        }),
      ];

      const registry = createRegistry(defs);
      const outcomes: StageOutcome[] = [];
      const onOutcome = vi.fn(async (outcome) => {
        outcomes.push(outcome);
      });

      const result = await runGraph(
        registry,
        ["congruence_panel" as StageKey],
        {},
        { onOutcome, now: mockClock }
      );

      const skippedOutcomes = outcomes.filter((o) => o.status === "paused");
      expect(skippedOutcomes.length).toBeGreaterThan(0);
      expect(result.skipped).toHaveLength(2);
    });

    it("records timestamps and duration", async () => {
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          run: vi.fn(async () => {
            clockValue += 100; // Simulate 100ms of work
            return {};
          }),
        }),
      ];

      const registry = createRegistry(defs);
      const outcomes: StageOutcome[] = [];
      const onOutcome = vi.fn(async (outcome) => {
        outcomes.push(outcome);
      });

      await runGraph(
        registry,
        ["blueprint_draft" as StageKey],
        {},
        { onOutcome, now: mockClock }
      );

      expect(outcomes[0].startedAt).toBe(new Date(1000).toISOString());
      expect(outcomes[0].completedAt).toBe(new Date(1100).toISOString());
      expect(outcomes[0].durationMs).toBe(100);
    });

    it("uses default clock when not provided", async () => {
      const defs = [mockStage({ key: "blueprint_draft" as StageKey })];
      const registry = createRegistry(defs);
      const onOutcome = vi.fn<(outcome: StageOutcome) => Promise<void>>(async () => {});

      const result = await runGraph(
        registry,
        ["blueprint_draft" as StageKey],
        {},
        { onOutcome }
        // No 'now' handler; should use Date.now()
      );

      expect(result.ok).toBe(true);
      // Timestamps should be valid ISO strings
      expect(result.outcomes[0].startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.outcomes[0].completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("collects stage logs in outcome detail", async () => {
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          run: vi.fn(async (ctx) => {
            ctx.log("Validating blueprint structure");
            ctx.log("Allocating items to cells");
            return {};
          }),
        }),
      ];

      const registry = createRegistry(defs);
      const outcomes: StageOutcome[] = [];
      const onOutcome = vi.fn(async (outcome) => {
        outcomes.push(outcome);
      });

      await runGraph(
        registry,
        ["blueprint_draft" as StageKey],
        {},
        { onOutcome, now: mockClock }
      );

      expect(outcomes[0].detail).toContain("Validating blueprint structure");
      expect(outcomes[0].detail).toContain("Allocating items to cells");
    });

    it("preserves error message when stage throws non-Error", async () => {
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          run: vi.fn(async () => {
             
            throw "raw error string";
          }),
        }),
      ];

      const registry = createRegistry(defs);
      const outcomes: StageOutcome[] = [];
      const onOutcome = vi.fn(async (outcome) => {
        outcomes.push(outcome);
      });

      await runGraph(
        registry,
        ["blueprint_draft" as StageKey],
        {},
        { onOutcome, now: mockClock }
      );

      expect(outcomes[0].error).toBe("raw error string");
    });

    it("handles empty request", async () => {
      const defs = [mockStage({ key: "blueprint_draft" as StageKey })];
      const registry = createRegistry(defs);
      const onOutcome = vi.fn<(outcome: StageOutcome) => Promise<void>>(async () => {});

      const result = await runGraph(registry, [], {}, { onOutcome });

      expect(result.outcomes).toHaveLength(0);
      expect(result.completed).toHaveLength(0);
      expect(result.ok).toBe(true);
      expect(onOutcome).not.toHaveBeenCalled();
    });

    it("returns ok=true only if no stages failed", async () => {
      // All success
      const defs1 = [mockStage({ key: "blueprint_draft" as StageKey })];
      const registry1 = createRegistry(defs1);
      const result1 = await runGraph(
        registry1,
        ["blueprint_draft" as StageKey],
        {},
        { onOutcome: vi.fn() }
      );
      expect(result1.ok).toBe(true);

      // With failure
      const defs2 = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          run: vi.fn(async () => {
            throw new Error("Failed");
          }),
        }),
      ];
      const registry2 = createRegistry(defs2);
      const result2 = await runGraph(
        registry2,
        ["blueprint_draft" as StageKey],
        {},
        { onOutcome: vi.fn() }
      );
      expect(result2.ok).toBe(false);
    });

    it("passes initial input to first stage", async () => {
      const inputReceived: Record<string, unknown>[] = [];
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          run: vi.fn(async (ctx, input) => {
            inputReceived.push(input);
            return {};
          }),
        }),
      ];

      const registry = createRegistry(defs);
      const initialInput = { userId: "user-123", projectId: "proj-456" };

      await runGraph(
        registry,
        ["blueprint_draft" as StageKey],
        initialInput,
        { onOutcome: vi.fn() }
      );

      expect(inputReceived[0]).toHaveProperty("userId", "user-123");
      expect(inputReceived[0]).toHaveProperty("projectId", "proj-456");
    });

    it("merges stage outputs sequentially", async () => {
      const defs = [
        mockStage({
          key: "blueprint_draft" as StageKey,
          run: vi.fn(async () => ({ stage1: "output1" })),
        }),
        mockStage({
          key: "item_generation" as StageKey,
          requires: ["blueprint_draft" as StageKey],
          run: vi.fn(async (ctx, input) => {
            expect(input).toHaveProperty("stage1");
            return { stage2: "output2" };
          }),
        }),
        mockStage({
          key: "congruence_panel" as StageKey,
          requires: ["item_generation" as StageKey],
          run: vi.fn(async (ctx, input) => {
            expect(input).toHaveProperty("stage1");
            expect(input).toHaveProperty("stage2");
            return { stage3: "output3" };
          }),
        }),
      ];

      const registry = createRegistry(defs);
      await runGraph(
        registry,
        ["congruence_panel" as StageKey],
        {},
        { onOutcome: vi.fn() }
      );

      // All stages should have been called
      expect(defs[0].run).toHaveBeenCalled();
      expect(defs[1].run).toHaveBeenCalled();
      expect(defs[2].run).toHaveBeenCalled();
    });
  });
});
