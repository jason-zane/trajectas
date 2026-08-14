/**
 * Stage definitions for the instrument builder pipeline.
 *
 * Pure module that creates stage definitions from injected effect handlers.
 * Stages define their dependencies, severity (blocking vs advisory), and run logic.
 * The module receives all side effects (DB access, LLM calls) as handler functions,
 * keeping the stage definitions themselves testable with zero mocking.
 *
 * @module
 */

import type { StageContext, StageDefinition } from './types'

/**
 * Effect handlers that stages use to perform their work.
 * All side effects (DB access, LLM calls, external services) flow through these.
 */
export interface StageEffects {
  /**
   * Draft a blueprint for this build.
   * Returns the count of cells created from the draft.
   */
  draftBlueprint(ctx: StageContext): Promise<{ cellCount: number }>

  /**
   * Validate the blueprint cells for logical and structural issues.
   * Returns errors (which block) and warnings (which pass but are logged).
   */
  validateBlueprint(ctx: StageContext): Promise<{
    errors: string[]
    warnings: string[]
  }>

  /**
   * Generate items to fill blueprint cells with insufficient coverage.
   * Returns the count of items generated and the count of cells that failed.
   */
  generateItems(ctx: StageContext): Promise<{
    generated: number
    failedCells: number
  }>

  /**
   * Audit the coverage of blueprint cells against generated items.
   * Returns whether coverage is complete and counts of empty and underfilled cells.
   */
  auditCoverage(ctx: StageContext): Promise<{
    isComplete: boolean
    emptyCells: number
    underfilledCells: number
  }>

  /**
   * Forecast reliability metrics (alpha, coherence) for the current item set.
   * Returns predicted alpha and coherence band classification.
   */
  forecastReliability(ctx: StageContext): Promise<{
    predictedAlpha: number
    coherence: string
  }>
}

/**
 * Create stage definitions for the instrument builder pipeline.
 *
 * Returns an array of stage definitions with dependencies, severity, and run logic.
 * Each stage is a pure function that receives effects and context injections.
 *
 * Dependency graph:
 *   blueprint_draft        (no deps)
 *   blueprint_validate     <- blueprint_draft
 *   item_generation        <- blueprint_validate
 *   coverage_audit         <- item_generation
 *   reliability_forecast   <- coverage_audit
 *
 * @param effects The set of effect handlers for this run
 * @returns Array of stage definitions
 */
export function createInstrumentStages(effects: StageEffects): StageDefinition[] {
  return [
    {
      key: 'blueprint_draft',
      requires: [],
      severity: 'advisory',
      run: async (ctx: StageContext) => {
        const result = await effects.draftBlueprint(ctx)
        ctx.log(`Drafted blueprint with ${result.cellCount} cells`)
        return { cellCount: result.cellCount }
      }
    },

    {
      key: 'blueprint_validate',
      requires: ['blueprint_draft'],
      severity: 'blocking',
      run: async (ctx: StageContext) => {
        const result = await effects.validateBlueprint(ctx)

        // Log warnings (these are non-blocking)
        if (result.warnings.length > 0) {
          result.warnings.forEach(w => {
            ctx.log(`Warning: ${w}`)
          })
        }

        // Errors are blocking: throw to fail this stage
        if (result.errors.length > 0) {
          const errorMsg = result.errors.join('; ')
          throw new Error(errorMsg)
        }

        ctx.log(`Blueprint validation passed (${result.warnings.length} warnings)`)
        return { validationErrors: result.errors.length, validationWarnings: result.warnings.length }
      }
    },

    {
      key: 'item_generation',
      requires: ['blueprint_validate'],
      severity: 'blocking',
      run: async (ctx: StageContext) => {
        const result = await effects.generateItems(ctx)

        // Success: generated > 0 OR no failed cells
        if (result.generated > 0) {
          if (result.failedCells > 0) {
            ctx.log(`Generated ${result.generated} items (${result.failedCells} cells failed but items produced)`)
          } else {
            ctx.log(`Generated ${result.generated} items`)
          }
          return { generated: result.generated, failedCells: result.failedCells }
        }

        // Failure: generated === 0 AND failedCells > 0
        if (result.failedCells > 0) {
          const msg = `Generation failed: 0 items produced and ${result.failedCells} cells encountered errors`
          throw new Error(msg)
        }

        // Edge case: both 0 (shouldn't happen)
        throw new Error('Generation produced no items and reported no failures')
      }
    },

    {
      key: 'coverage_audit',
      requires: ['item_generation'],
      severity: 'blocking',
      run: async (ctx: StageContext) => {
        const result = await effects.auditCoverage(ctx)

        // Failure: any empty cells (content-validity hole)
        if (result.emptyCells > 0) {
          const msg = `Coverage audit failed: ${result.emptyCells} empty cell(s) detected`
          throw new Error(msg)
        }

        // Warning: underfilled cells pass but log
        if (result.underfilledCells > 0) {
          ctx.log(`Coverage audit: ${result.underfilledCells} underfilled cell(s)`)
        }

        if (result.isComplete) {
          ctx.log('Coverage audit complete')
        } else {
          ctx.log('Coverage audit: partial coverage')
        }

        return { isComplete: result.isComplete, emptyCells: result.emptyCells, underfilledCells: result.underfilledCells }
      }
    },

    {
      key: 'reliability_forecast',
      requires: ['coverage_audit'],
      severity: 'advisory',
      run: async (ctx: StageContext) => {
        const result = await effects.forecastReliability(ctx)
        ctx.log(`Predicted alpha = ${result.predictedAlpha.toFixed(3)}, coherence = ${result.coherence}`)
        return { predictedAlpha: result.predictedAlpha, coherence: result.coherence }
      }
    }
  ]
}
