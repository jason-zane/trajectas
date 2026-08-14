/**
 * Test suite for stage definitions.
 *
 * Verifies dependency resolution, stage semantics (when they throw, when they pass),
 * log calls, and integration with the stage graph runner.
 *
 * @module
 */

import { describe, it, expect, vi } from "vitest"
import { createInstrumentStages, type StageEffects } from "@/lib/instrument/stages/definitions"
import { createRegistry } from "@/lib/instrument/stages/registry"
import { runGraph } from "@/lib/instrument/stages/runner"
import type { StageContext } from "@/lib/instrument/stages/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal stub effects object.
 * All handlers return success by default; override individual handlers for specific tests.
 */
function createStubEffects(overrides: Partial<StageEffects> = {}): StageEffects {
  return {
    draftBlueprint: vi.fn(async () => ({ cellCount: 3 })),
    validateBlueprint: vi.fn(async () => ({ errors: [], warnings: [] })),
    generateItems: vi.fn(async () => ({ generated: 9, failedCells: 0 })),
    auditCoverage: vi.fn(async () => ({
      isComplete: true,
      emptyCells: 0,
      underfilledCells: 0,
    })),
    forecastReliability: vi.fn(async () => ({
      predictedAlpha: 0.82,
      coherence: "optimal",
    })),
    ...overrides,
  }
}

/**
 * Create a stage context stub with a log collector.
 */
function createStubContext(): {
  ctx: StageContext
  logs: string[]
} {
  const logs: string[] = []
  const ctx: StageContext = {
    buildId: "test-build-123",
    measureType: "trait",
    log: (detail: string) => logs.push(detail),
  }
  return { ctx, logs }
}

// ---------------------------------------------------------------------------
// Dependency Resolution
// ---------------------------------------------------------------------------

describe("stage definitions: dependency resolution", () => {
  it("should define stages with the correct dependency graph", () => {
    const effects = createStubEffects()
    const stages = createInstrumentStages(effects)

    // Check that all expected stages are defined
    const keys = new Set(stages.map(s => s.key))
    expect(keys.has("blueprint_draft")).toBe(true)
    expect(keys.has("blueprint_validate")).toBe(true)
    expect(keys.has("item_generation")).toBe(true)
    expect(keys.has("coverage_audit")).toBe(true)
    expect(keys.has("reliability_forecast")).toBe(true)
  })

  it("should resolve execution order correctly", () => {
    const effects = createStubEffects()
    const stages = createInstrumentStages(effects)
    const registry = createRegistry(stages)

    const order = registry.resolveOrder([
      "reliability_forecast",
      "blueprint_draft",
      "coverage_audit",
    ])

    // Expect stages in dependency order
    expect(order.indexOf("blueprint_draft")).toBeLessThan(
      order.indexOf("blueprint_validate")
    )
    expect(order.indexOf("blueprint_validate")).toBeLessThan(
      order.indexOf("item_generation")
    )
    expect(order.indexOf("item_generation")).toBeLessThan(
      order.indexOf("coverage_audit")
    )
    expect(order.indexOf("coverage_audit")).toBeLessThan(
      order.indexOf("reliability_forecast")
    )
  })

  it("should include transitive dependencies", () => {
    const effects = createStubEffects()
    const stages = createInstrumentStages(effects)
    const registry = createRegistry(stages)

    // Requesting only coverage_audit should pull in all dependencies
    const order = registry.resolveOrder(["coverage_audit"])

    expect(order).toContain("blueprint_draft")
    expect(order).toContain("blueprint_validate")
    expect(order).toContain("item_generation")
    expect(order).toContain("coverage_audit")
    expect(order).not.toContain("reliability_forecast") // Not a dependency
  })

  it("should mark blueprint_draft as advisory", () => {
    const effects = createStubEffects()
    const stages = createInstrumentStages(effects)
    const draftStage = stages.find(s => s.key === "blueprint_draft")

    expect(draftStage).toBeDefined()
    expect(draftStage!.severity).toBe("advisory")
  })

  it("should mark blueprint_validate as blocking", () => {
    const effects = createStubEffects()
    const stages = createInstrumentStages(effects)
    const validateStage = stages.find(s => s.key === "blueprint_validate")

    expect(validateStage).toBeDefined()
    expect(validateStage!.severity).toBe("blocking")
  })

  it("should mark item_generation as blocking", () => {
    const effects = createStubEffects()
    const stages = createInstrumentStages(effects)
    const genStage = stages.find(s => s.key === "item_generation")

    expect(genStage).toBeDefined()
    expect(genStage!.severity).toBe("blocking")
  })

  it("should mark coverage_audit as blocking", () => {
    const effects = createStubEffects()
    const stages = createInstrumentStages(effects)
    const auditStage = stages.find(s => s.key === "coverage_audit")

    expect(auditStage).toBeDefined()
    expect(auditStage!.severity).toBe("blocking")
  })

  it("should mark reliability_forecast as advisory", () => {
    const effects = createStubEffects()
    const stages = createInstrumentStages(effects)
    const forecastStage = stages.find(s => s.key === "reliability_forecast")

    expect(forecastStage).toBeDefined()
    expect(forecastStage!.severity).toBe("advisory")
  })
})

// ---------------------------------------------------------------------------
// blueprint_draft Stage
// ---------------------------------------------------------------------------

describe("blueprint_draft stage", () => {
  it("should call draftBlueprint effect and log result", async () => {
    const effects = createStubEffects({
      draftBlueprint: vi.fn(async () => ({ cellCount: 5 })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "blueprint_draft")
    const { ctx, logs } = createStubContext()

    const result = await stage!.run(ctx, {})

    expect(effects.draftBlueprint).toHaveBeenCalledWith(ctx)
    expect(result).toEqual({ cellCount: 5 })
    expect(logs.length).toBeGreaterThan(0)
    expect(logs[0]).toContain("5")
    expect(logs[0]).toContain("cell")
  })

  it("should not throw even if draftBlueprint returns 0 cells", async () => {
    const effects = createStubEffects({
      draftBlueprint: vi.fn(async () => ({ cellCount: 0 })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "blueprint_draft")
    const { ctx } = createStubContext()

    await expect(stage!.run(ctx, {})).resolves.toEqual({ cellCount: 0 })
  })
})

// ---------------------------------------------------------------------------
// blueprint_validate Stage
// ---------------------------------------------------------------------------

describe("blueprint_validate stage", () => {
  it("should pass when there are no errors (even with warnings)", async () => {
    const effects = createStubEffects({
      validateBlueprint: vi.fn(async () => ({
        errors: [],
        warnings: ["Warning 1", "Warning 2"],
      })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "blueprint_validate")
    const { ctx, logs } = createStubContext()

    const result = await stage!.run(ctx, {})

    expect(result).toBeDefined()
    expect(logs.length).toBeGreaterThanOrEqual(2) // At least the two warnings
    expect(logs.some(l => l.includes("Warning 1"))).toBe(true)
    expect(logs.some(l => l.includes("Warning 2"))).toBe(true)
  })

  it("should log validation warnings", async () => {
    const effects = createStubEffects({
      validateBlueprint: vi.fn(async () => ({
        errors: [],
        warnings: ["Facet too narrow", "Total items < 4"],
      })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "blueprint_validate")
    const { ctx, logs } = createStubContext()

    await stage!.run(ctx, {})

    expect(logs.some(l => l.includes("Facet too narrow"))).toBe(true)
    expect(logs.some(l => l.includes("Total items < 4"))).toBe(true)
  })

  it("should throw when there are errors", async () => {
    const effects = createStubEffects({
      validateBlueprint: vi.fn(async () => ({
        errors: ["Duplicate facet", "Invalid cell"],
        warnings: [],
      })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "blueprint_validate")
    const { ctx } = createStubContext()

    await expect(stage!.run(ctx, {})).rejects.toThrow(
      "Duplicate facet"
    )
  })

  it("should include all errors in the thrown message", async () => {
    const effects = createStubEffects({
      validateBlueprint: vi.fn(async () => ({
        errors: ["Error 1", "Error 2", "Error 3"],
        warnings: [],
      })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "blueprint_validate")
    const { ctx } = createStubContext()

    try {
      await stage!.run(ctx, {})
      expect.fail("Should have thrown")
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      expect(msg).toContain("Error 1")
      expect(msg).toContain("Error 2")
      expect(msg).toContain("Error 3")
    }
  })
})

// ---------------------------------------------------------------------------
// item_generation Stage
// ---------------------------------------------------------------------------

describe("item_generation stage", () => {
  it("should succeed when items are generated", async () => {
    const effects = createStubEffects({
      generateItems: vi.fn(async () => ({ generated: 12, failedCells: 0 })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "item_generation")
    const { ctx, logs } = createStubContext()

    const result = await stage!.run(ctx, {})

    expect(result).toEqual({ generated: 12, failedCells: 0 })
    expect(logs[0]).toContain("Generated")
    expect(logs[0]).toContain("12")
  })

  it("should succeed with partial failure (generated > 0 and failedCells > 0)", async () => {
    const effects = createStubEffects({
      generateItems: vi.fn(async () => ({ generated: 8, failedCells: 2 })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "item_generation")
    const { ctx, logs } = createStubContext()

    const result = await stage!.run(ctx, {})

    expect(result).toEqual({ generated: 8, failedCells: 2 })
    expect(logs[0]).toContain("8")
    expect(logs[0]).toContain("2")
    expect(logs[0]).toContain("failed")
  })

  it("should fail when generated === 0 and failedCells > 0", async () => {
    const effects = createStubEffects({
      generateItems: vi.fn(async () => ({ generated: 0, failedCells: 3 })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "item_generation")
    const { ctx } = createStubContext()

    await expect(stage!.run(ctx, {})).rejects.toThrow("Generation failed")
  })

  it("should fail when both generated and failedCells are 0", async () => {
    const effects = createStubEffects({
      generateItems: vi.fn(async () => ({ generated: 0, failedCells: 0 })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "item_generation")
    const { ctx } = createStubContext()

    await expect(stage!.run(ctx, {})).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// coverage_audit Stage
// ---------------------------------------------------------------------------

describe("coverage_audit stage", () => {
  it("should pass when coverage is complete (no empty cells)", async () => {
    const effects = createStubEffects({
      auditCoverage: vi.fn(async () => ({
        isComplete: true,
        emptyCells: 0,
        underfilledCells: 0,
      })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "coverage_audit")
    const { ctx, logs } = createStubContext()

    const result = await stage!.run(ctx, {})

    expect(result).toBeDefined()
    expect(logs.some(l => l.includes("complete"))).toBe(true)
  })

  it("should pass with underfilled cells but log a warning", async () => {
    const effects = createStubEffects({
      auditCoverage: vi.fn(async () => ({
        isComplete: false,
        emptyCells: 0,
        underfilledCells: 2,
      })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "coverage_audit")
    const { ctx, logs } = createStubContext()

    const result = await stage!.run(ctx, {})

    expect(result).toBeDefined()
    expect(logs.some(l => l.includes("underfilled"))).toBe(true)
    expect(logs.some(l => l.includes("2"))).toBe(true)
  })

  it("should fail when there are empty cells", async () => {
    const effects = createStubEffects({
      auditCoverage: vi.fn(async () => ({
        isComplete: false,
        emptyCells: 1,
        underfilledCells: 0,
      })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "coverage_audit")
    const { ctx } = createStubContext()

    await expect(stage!.run(ctx, {})).rejects.toThrow("Coverage audit failed")
  })

  it("should fail when multiple cells are empty", async () => {
    const effects = createStubEffects({
      auditCoverage: vi.fn(async () => ({
        isComplete: false,
        emptyCells: 3,
        underfilledCells: 1,
      })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "coverage_audit")
    const { ctx } = createStubContext()

    try {
      await stage!.run(ctx, {})
      expect.fail("Should have thrown")
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      expect(msg).toContain("3")
    }
  })
})

// ---------------------------------------------------------------------------
// reliability_forecast Stage
// ---------------------------------------------------------------------------

describe("reliability_forecast stage", () => {
  it("should never throw (advisory)", async () => {
    const effects = createStubEffects({
      forecastReliability: vi.fn(async () => ({
        predictedAlpha: 0.82,
        coherence: "optimal",
      })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "reliability_forecast")
    const { ctx } = createStubContext()

    await expect(stage!.run(ctx, {})).resolves.toBeDefined()
  })

  it("should log predicted alpha and coherence", async () => {
    const effects = createStubEffects({
      forecastReliability: vi.fn(async () => ({
        predictedAlpha: 0.75,
        coherence: "broad",
      })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "reliability_forecast")
    const { ctx, logs } = createStubContext()

    await stage!.run(ctx, {})

    expect(logs[0]).toContain("0.750")
    expect(logs[0]).toContain("broad")
  })

  it("should handle low alpha gracefully", async () => {
    const effects = createStubEffects({
      forecastReliability: vi.fn(async () => ({
        predictedAlpha: 0.45,
        coherence: "incoherent",
      })),
    })
    const stages = createInstrumentStages(effects)
    const stage = stages.find(s => s.key === "reliability_forecast")
    const { ctx, logs } = createStubContext()

    await expect(stage!.run(ctx, {})).resolves.toBeDefined()
    expect(logs[0]).toContain("0.450")
  })
})

// ---------------------------------------------------------------------------
// Stage Graph Integration
// ---------------------------------------------------------------------------

describe("stage graph integration", () => {
  it("should call log on all stages", async () => {
    const effects = createStubEffects()
    const stages = createInstrumentStages(effects)
    const registry = createRegistry(stages)

    const result = await runGraph(
      registry,
      ["reliability_forecast"],
      {},
      {
        onOutcome: async () => {},
        now: () => 0,
      }
    )

    // Every stage should have completed (with logs called by each)
    expect(result.completed.length).toBeGreaterThan(0)
  })

  it("should skip remaining stages when a blocking stage fails", async () => {
    const effects = createStubEffects({
      validateBlueprint: vi.fn(async () => ({
        errors: ["Invalid blueprint"],
        warnings: [],
      })),
    })
    const stages = createInstrumentStages(effects)
    const registry = createRegistry(stages)

    const outcomes: Array<{ key: string; status: string }> = []
    const result = await runGraph(
      registry,
      ["reliability_forecast"],
      {},
      {
        onOutcome: async (outcome) => {
          outcomes.push({ key: outcome.key, status: outcome.status })
        },
        now: () => 0,
      }
    )

    // blueprint_draft should complete
    expect(outcomes.some(o => o.key === "blueprint_draft" && o.status === "success")).toBe(true)

    // blueprint_validate should fail
    expect(outcomes.some(o => o.key === "blueprint_validate" && o.status === "failure")).toBe(true)

    // item_generation, coverage_audit, reliability_forecast should be skipped
    expect(outcomes.some(o => o.key === "item_generation" && o.status === "paused")).toBe(true)
    expect(outcomes.some(o => o.key === "coverage_audit" && o.status === "paused")).toBe(true)
    expect(outcomes.some(o => o.key === "reliability_forecast" && o.status === "paused")).toBe(true)

    expect(result.ok).toBe(false)
  })

  it("should continue after an advisory stage fails", async () => {
    const effects = createStubEffects({
      draftBlueprint: vi.fn(async () => {
        throw new Error("Draft failed")
      }),
    })
    const stages = createInstrumentStages(effects)
    const registry = createRegistry(stages)

    const outcomes: Array<{ key: string; status: string }> = []
    await runGraph(
      registry,
      ["item_generation"],
      {},
      {
        onOutcome: async (outcome) => {
          outcomes.push({ key: outcome.key, status: outcome.status })
        },
        now: () => 0,
      }
    )

    // blueprint_draft should fail
    expect(outcomes.some(o => o.key === "blueprint_draft" && o.status === "failure")).toBe(true)

    // blueprint_validate should continue (advisory stage failed, so blocking can still run)
    expect(outcomes.some(o => o.key === "blueprint_validate")).toBe(true)
  })

  it("should skip all stages when a blocking stage in the middle fails", async () => {
    const effects = createStubEffects({
      generateItems: vi.fn(async () => ({
        generated: 0,
        failedCells: 2,
      })),
    })
    const stages = createInstrumentStages(effects)
    const registry = createRegistry(stages)

    const outcomes: Array<{ key: string; status: string }> = []
    await runGraph(
      registry,
      ["reliability_forecast"],
      {},
      {
        onOutcome: async (outcome) => {
          outcomes.push({ key: outcome.key, status: outcome.status })
        },
        now: () => 0,
      }
    )

    // item_generation should fail
    expect(outcomes.some(o => o.key === "item_generation" && o.status === "failure")).toBe(true)

    // coverage_audit and reliability_forecast should be skipped
    expect(outcomes.some(o => o.key === "coverage_audit" && o.status === "paused")).toBe(true)
    expect(outcomes.some(o => o.key === "reliability_forecast" && o.status === "paused")).toBe(true)
  })

  it("should mark ok=false when any blocking stage fails", async () => {
    const effects = createStubEffects({
      auditCoverage: vi.fn(async () => ({
        isComplete: false,
        emptyCells: 1,
        underfilledCells: 0,
      })),
    })
    const stages = createInstrumentStages(effects)
    const registry = createRegistry(stages)

    const result = await runGraph(
      registry,
      ["reliability_forecast"],
      {},
      {
        onOutcome: async () => {},
        now: () => 0,
      }
    )

    expect(result.ok).toBe(false)
    expect(result.failed).toContain("coverage_audit")
  })

  it("should allow blocking stages to continue even when an advisory stage fails", async () => {
    const effects = createStubEffects({
      draftBlueprint: vi.fn(async () => {
        throw new Error("Draft failed")
      }),
    })
    const stages = createInstrumentStages(effects)
    const registry = createRegistry(stages)

    const result = await runGraph(
      registry,
      ["coverage_audit"],
      {},
      {
        onOutcome: async () => {},
        now: () => 0,
      }
    )

    // coverage_audit and its dependencies should complete
    expect(result.completed).toContain("blueprint_validate")
    expect(result.completed).toContain("item_generation")
    expect(result.completed).toContain("coverage_audit")

    // blueprint_draft failed (advisory), so ok should be false
    expect(result.failed).toContain("blueprint_draft")
    expect(result.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Context Injection
// ---------------------------------------------------------------------------

describe("stage context injection", () => {
  it("should pass the same context to each stage", async () => {
    const capturedContexts: Array<{ buildId: string; measureType: string }> = []

    const effects = createStubEffects({
      draftBlueprint: vi.fn(async (ctx) => {
        capturedContexts.push({ buildId: ctx.buildId, measureType: ctx.measureType })
        return { cellCount: 2 }
      }),
      validateBlueprint: vi.fn(async (ctx) => {
        capturedContexts.push({ buildId: ctx.buildId, measureType: ctx.measureType })
        return { errors: [], warnings: [] }
      }),
    })

    const stages = createInstrumentStages(effects)
    const stage1 = stages.find(s => s.key === "blueprint_draft")!
    const stage2 = stages.find(s => s.key === "blueprint_validate")!

    const { ctx } = createStubContext()
    await stage1.run(ctx, {})
    await stage2.run(ctx, {})

    expect(capturedContexts.length).toBe(2)
    expect(capturedContexts[0].buildId).toBe(ctx.buildId)
    expect(capturedContexts[1].buildId).toBe(ctx.buildId)
  })
})
