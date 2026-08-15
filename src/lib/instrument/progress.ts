/**
 * Progress rail computation for the instrument builder workspace.
 * PURE functions: given DTOs and congruence data, compute the state of each step.
 * No database access, no side effects. Unit-testable.
 *
 * @module
 */

import type {
  InstrumentBuildDto,
  InstrumentBlueprintDto,
  InstrumentCandidateItemDto,
} from '@/lib/dal/instrument-mappers'
import type { BlueprintCell } from './types'
import type { PanelResult } from './congruence'
import { CONGRUENCE_THRESHOLDS } from './congruence'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StepState = 'not_started' | 'in_progress' | 'needs_attention' | 'complete'

export interface ProgressStep {
  key: 'brief' | 'structure' | 'blueprint' | 'items' | 'evidence' | 'publish'
  label: string
  state: StepState
  description?: string
}

export interface BuildProgress {
  steps: ProgressStep[]
  overallState: StepState
  nextStep?: ProgressStep
}

// ---------------------------------------------------------------------------
// Signal computation functions
// ---------------------------------------------------------------------------

/**
 * Step 1: BRIEF
 * Complete if build has a brief set.
 */
export function computeBriefState(build: InstrumentBuildDto): StepState {
  if (!build.brief || build.brief.trim() === '') {
    return 'not_started'
  }
  return 'complete'
}

/**
 * Step 2: STRUCTURE
 * Complete if any blueprints exist (constructs proposed and created).
 */
export function computeStructureState(blueprints: InstrumentBlueprintDto[]): StepState {
  if (blueprints.length === 0) {
    return 'not_started'
  }
  return 'complete'
}

/**
 * Step 3: BLUEPRINT
 * Complete if all blueprints have cells (have been defined).
 * In progress if at least one blueprint exists but some lack cells.
 * Not started if no blueprints exist.
 */
export function computeBlueprintState(
  blueprints: InstrumentBlueprintDto[],
  cellsByBlueprintId: Record<string, BlueprintCell[]>,
): StepState {
  if (blueprints.length === 0) {
    return 'not_started'
  }

  const allHaveCells = blueprints.every((bp) => {
    const cells = cellsByBlueprintId[bp.id] ?? []
    return cells.length > 0
  })

  if (allHaveCells) {
    return 'complete'
  }

  return 'in_progress'
}

/**
 * Step 4: ITEMS
 * Complete if items exist and all cells have met or exceeded their target count.
 * Needs attention if items exist but some cells are below target.
 * In progress if no items exist yet but blueprints/cells exist.
 * Not started if no blueprints/cells exist.
 */
export function computeItemsState(
  blueprints: InstrumentBlueprintDto[],
  cellsByBlueprintId: Record<string, BlueprintCell[]>,
  itemsByBlueprintId: Record<string, InstrumentCandidateItemDto[]>,
): StepState {
  if (blueprints.length === 0) {
    return 'not_started'
  }

  // Check if we have any cells across all blueprints
  const hasCells = blueprints.some((bp) => {
    const cells = cellsByBlueprintId[bp.id] ?? []
    return cells.length > 0
  })

  if (!hasCells) {
    return 'not_started'
  }

  // Check if we have any items
  const hasItems = blueprints.some((bp) => {
    const items = itemsByBlueprintId[bp.id] ?? []
    return items.length > 0
  })

  if (!hasItems) {
    return 'in_progress'
  }

  // Check if all cells have met their target count
  let underTargetCount = 0
  for (const blueprint of blueprints) {
    const cells = cellsByBlueprintId[blueprint.id] ?? []
    const items = itemsByBlueprintId[blueprint.id] ?? []

    for (const cell of cells) {
      const cellItems = items.filter((i) => i.blueprintCellId === cell.id)
      const targetCount = cell.targetItemCount ?? 2
      if (cellItems.length < targetCount) {
        underTargetCount++
      }
    }
  }

  if (underTargetCount > 0) {
    return 'needs_attention'
  }

  return 'complete'
}

/**
 * Step 5: EVIDENCE
 * Complete if congruence ratings exist AND mean accuracy >= passAccuracy threshold (0.80).
 * Needs attention if ratings exist but accuracy is below passAccuracy.
 * In progress if no ratings yet but items exist.
 * Not started if no items.
 */
export function computeEvidenceState(
  blueprints: InstrumentBlueprintDto[],
  cellsByBlueprintId: Record<string, BlueprintCell[]>,
  itemsByBlueprintId: Record<string, InstrumentCandidateItemDto[]>,
  panelResult: PanelResult | null,
): StepState {
  // Check if we have cells and items (prerequisite)
  const hasCells = blueprints.some((bp) => {
    const cells = cellsByBlueprintId[bp.id] ?? []
    return cells.length > 0
  })

  const hasItems = blueprints.some((bp) => {
    const items = itemsByBlueprintId[bp.id] ?? []
    return items.length > 0
  })

  if (!hasCells || !hasItems) {
    return 'not_started'
  }

  if (!panelResult || panelResult.items.length === 0) {
    return 'in_progress'
  }

  // Check if mean accuracy meets the pass threshold
  const meanAccuracy = panelResult.overall.meanAccuracy
  if (meanAccuracy >= CONGRUENCE_THRESHOLDS.passAccuracy) {
    return 'complete'
  }

  return 'needs_attention'
}

/**
 * Step 6: PUBLISH
 * Complete if published_item_id is set on accepted items.
 * Needs attention if evidence is not yet complete (prerequisite).
 * In progress if evidence is complete but no items published yet.
 * Not started otherwise.
 */
export function computePublishState(
  blueprints: InstrumentBlueprintDto[],
  cellsByBlueprintId: Record<string, BlueprintCell[]>,
  itemsByBlueprintId: Record<string, InstrumentCandidateItemDto[]>,
  panelResult: PanelResult | null,
): StepState {
  // Check prerequisite: evidence complete
  const evidenceState = computeEvidenceState(
    blueprints,
    cellsByBlueprintId,
    itemsByBlueprintId,
    panelResult,
  )

  if (evidenceState !== 'complete') {
    return 'not_started'
  }

  // Check if any items have been published
  const hasPublishedItems = blueprints.some((bp) => {
    const items = itemsByBlueprintId[bp.id] ?? []
    return items.some((i) => !!i.publishedItemId)
  })

  if (!hasPublishedItems) {
    return 'in_progress'
  }

  return 'complete'
}

// ---------------------------------------------------------------------------
// Main progress computation
// ---------------------------------------------------------------------------

/**
 * Compute the full progress rail state from available DTOs and congruence data.
 *
 * @param build - The instrument build
 * @param blueprints - All blueprints for this build
 * @param cellsByBlueprintId - Cells keyed by blueprint ID
 * @param itemsByBlueprintId - Items keyed by blueprint ID
 * @param panelResult - Congruence panel result (null if not yet computed)
 * @returns BuildProgress with all six steps and overall state
 */
export function computeBuildProgress(
  build: InstrumentBuildDto,
  blueprints: InstrumentBlueprintDto[],
  cellsByBlueprintId: Record<string, BlueprintCell[]>,
  itemsByBlueprintId: Record<string, InstrumentCandidateItemDto[]>,
  panelResult: PanelResult | null,
): BuildProgress {
  const briefState = computeBriefState(build)
  const structureState = computeStructureState(blueprints)
  const blueprintState = computeBlueprintState(blueprints, cellsByBlueprintId)
  const itemsState = computeItemsState(blueprints, cellsByBlueprintId, itemsByBlueprintId)
  const evidenceState = computeEvidenceState(
    blueprints,
    cellsByBlueprintId,
    itemsByBlueprintId,
    panelResult,
  )
  const publishState = computePublishState(
    blueprints,
    cellsByBlueprintId,
    itemsByBlueprintId,
    panelResult,
  )

  const steps: ProgressStep[] = [
    {
      key: 'brief',
      label: 'Brief',
      state: briefState,
      description: 'Write a brief description of what you are measuring',
    },
    {
      key: 'structure',
      label: 'Structure',
      state: structureState,
      description: 'Propose constructs and confirm the set',
    },
    {
      key: 'blueprint',
      label: 'Blueprint',
      state: blueprintState,
      description: 'Define constructs with cells (facets × intensity)',
    },
    {
      key: 'items',
      label: 'Items',
      state: itemsState,
      description: 'Generate and refine candidate items',
    },
    {
      key: 'evidence',
      label: 'Evidence',
      state: evidenceState,
      description: 'Run congruence review and ensure accuracy',
    },
    {
      key: 'publish',
      label: 'Publish',
      state: publishState,
      description: 'Finalize and publish items to the library',
    },
  ]

  // Compute overall state: if any step is needs_attention, overall is needs_attention
  // Otherwise, use the highest completed step
  let overallState: StepState = 'not_started'
  let needsAttention = false

  for (const step of steps) {
    if (step.state === 'needs_attention') {
      needsAttention = true
    }
    if (step.state === 'complete') {
      overallState = 'complete'
    } else if (step.state === 'in_progress' && overallState === 'not_started') {
      overallState = 'in_progress'
    }
  }

  if (needsAttention) {
    overallState = 'needs_attention'
  }

  // Next step: first non-complete step
  const nextStep = steps.find((s) => s.state !== 'complete')

  return {
    steps,
    overallState,
    nextStep,
  }
}
