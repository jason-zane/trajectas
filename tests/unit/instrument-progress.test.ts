/**
 * Tests for instrument build progress computation.
 */

import { describe, it, expect } from 'vitest'
import type {
  InstrumentBuildDto,
  InstrumentBlueprintDto,
  InstrumentCandidateItemDto,
} from '@/lib/dal/instrument-mappers'
import type { BlueprintCell } from '@/lib/instrument/types'
import type { PanelResult } from '@/lib/instrument/congruence'
import {
  computeBriefState,
  computeStructureState,
  computeBlueprintState,
  computeItemsState,
  computeEvidenceState,
  computePublishState,
  computeBuildProgress,
} from '@/lib/instrument/progress'

// ---------------------------------------------------------------------------
// Test Data Fixtures
// ---------------------------------------------------------------------------

function createBuild(overrides: Partial<InstrumentBuildDto> = {}): InstrumentBuildDto {
  return {
    id: 'build-1',
    name: 'Test Build',
    status: 'draft',
    measureType: 'competency_behavioural',
    createdAt: '2026-08-15T00:00:00Z',
    updatedAt: '2026-08-15T00:00:00Z',
    ...overrides,
  }
}

function createBlueprint(
  overrides: Partial<InstrumentBlueprintDto> = {},
): InstrumentBlueprintDto {
  return {
    id: 'bp-1',
    buildId: 'build-1',
    constructId: 'construct-1',
    draftConstructName: 'Test Construct',
    measureType: 'competency_behavioural',
    version: 1,
    status: 'draft',
    createdAt: '2026-08-15T00:00:00Z',
    updatedAt: '2026-08-15T00:00:00Z',
    ...overrides,
  }
}

function createCell(overrides: Partial<BlueprintCell> = {}): BlueprintCell {
  return {
    id: 'cell-1',
    facetLabel: 'Communication',
    intensity: 'mid',
    targetItemCount: 2,
    displayOrder: 0,
    ...overrides,
  }
}

function createItem(
  overrides: Partial<InstrumentCandidateItemDto> = {},
): InstrumentCandidateItemDto {
  return {
    id: 'item-1',
    buildId: 'build-1',
    blueprintCellId: 'cell-1',
    stem: 'Test item stem',
    status: 'candidate',
    createdAt: '2026-08-15T00:00:00Z',
    updatedAt: '2026-08-15T00:00:00Z',
    ...overrides,
  }
}

function createPanelResult(overrides: Partial<PanelResult> = {}): PanelResult {
  return {
    items: [
      {
        itemId: 'item-1',
        intendedConstructId: 'bp-1',
        raterCount: 2,
        assignmentAccuracy: 0.85,
        aikenV: 0.80,
        modalConstructId: 'bp-1',
        modalShare: 0.85,
        verdict: 'pass',
      },
    ],
    fleissKappa: 0.75,
    confusion: {},
    constructSummaries: [
      {
        constructId: 'bp-1',
        itemCount: 1,
        meanAccuracy: 0.85,
        meanAikenV: 0.80,
        passRate: 1.0,
      },
    ],
    overall: {
      itemCount: 1,
      raterCount: 2,
      passRate: 1.0,
      meanAccuracy: 0.85,
      meanAikenV: 0.80,
    },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests: computeBriefState
// ---------------------------------------------------------------------------

describe('computeBriefState', () => {
  it('returns not_started when brief is not set', () => {
    const build = createBuild({ brief: undefined })
    expect(computeBriefState(build)).toBe('not_started')
  })

  it('returns not_started when brief is empty string', () => {
    const build = createBuild({ brief: '' })
    expect(computeBriefState(build)).toBe('not_started')
  })

  it('returns not_started when brief is whitespace only', () => {
    const build = createBuild({ brief: '   ' })
    expect(computeBriefState(build)).toBe('not_started')
  })

  it('returns complete when brief is set', () => {
    const build = createBuild({ brief: 'Measure leadership capability' })
    expect(computeBriefState(build)).toBe('complete')
  })
})

// ---------------------------------------------------------------------------
// Tests: computeStructureState
// ---------------------------------------------------------------------------

describe('computeStructureState', () => {
  it('returns not_started when no blueprints exist', () => {
    expect(computeStructureState([])).toBe('not_started')
  })

  it('returns complete when blueprints exist', () => {
    const blueprints = [createBlueprint()]
    expect(computeStructureState(blueprints)).toBe('complete')
  })

  it('returns complete when multiple blueprints exist', () => {
    const blueprints = [
      createBlueprint({ id: 'bp-1' }),
      createBlueprint({ id: 'bp-2' }),
    ]
    expect(computeStructureState(blueprints)).toBe('complete')
  })
})

// ---------------------------------------------------------------------------
// Tests: computeBlueprintState
// ---------------------------------------------------------------------------

describe('computeBlueprintState', () => {
  it('returns not_started when no blueprints exist', () => {
    expect(computeBlueprintState([], {})).toBe('not_started')
  })

  it('returns in_progress when blueprints exist but have no cells', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = { 'bp-1': [] }
    expect(computeBlueprintState(blueprints, cellsByBlueprintId)).toBe('in_progress')
  })

  it('returns in_progress when some blueprints have cells and others do not', () => {
    const blueprints = [
      createBlueprint({ id: 'bp-1' }),
      createBlueprint({ id: 'bp-2' }),
    ]
    const cellsByBlueprintId = {
      'bp-1': [createCell()],
      'bp-2': [],
    }
    expect(computeBlueprintState(blueprints, cellsByBlueprintId)).toBe('in_progress')
  })

  it('returns complete when all blueprints have cells', () => {
    const blueprints = [
      createBlueprint({ id: 'bp-1' }),
      createBlueprint({ id: 'bp-2' }),
    ]
    const cellsByBlueprintId = {
      'bp-1': [createCell()],
      'bp-2': [createCell()],
    }
    expect(computeBlueprintState(blueprints, cellsByBlueprintId)).toBe('complete')
  })

  it('returns complete when blueprint has multiple cells', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = {
      'bp-1': [createCell({ id: 'cell-1' }), createCell({ id: 'cell-2' })],
    }
    expect(computeBlueprintState(blueprints, cellsByBlueprintId)).toBe('complete')
  })
})

// ---------------------------------------------------------------------------
// Tests: computeItemsState
// ---------------------------------------------------------------------------

describe('computeItemsState', () => {
  it('returns not_started when no blueprints exist', () => {
    expect(computeItemsState([], {}, {})).toBe('not_started')
  })

  it('returns not_started when blueprints exist but no cells', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = { 'bp-1': [] }
    expect(computeItemsState(blueprints, cellsByBlueprintId, {})).toBe('not_started')
  })

  it('returns in_progress when cells exist but no items', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = { 'bp-1': [createCell()] }
    const itemsByBlueprintId = { 'bp-1': [] }
    expect(computeItemsState(blueprints, cellsByBlueprintId, itemsByBlueprintId)).toBe(
      'in_progress',
    )
  })

  it('returns needs_attention when items exist but below target', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = {
      'bp-1': [createCell({ id: 'cell-1', targetItemCount: 5 })],
    }
    const itemsByBlueprintId = {
      'bp-1': [
        createItem({ id: 'item-1', blueprintCellId: 'cell-1' }),
        createItem({ id: 'item-2', blueprintCellId: 'cell-1' }),
      ],
    }
    expect(computeItemsState(blueprints, cellsByBlueprintId, itemsByBlueprintId)).toBe(
      'needs_attention',
    )
  })

  it('returns complete when all cells meet target', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = {
      'bp-1': [createCell({ id: 'cell-1', targetItemCount: 2 })],
    }
    const itemsByBlueprintId = {
      'bp-1': [
        createItem({ id: 'item-1', blueprintCellId: 'cell-1' }),
        createItem({ id: 'item-2', blueprintCellId: 'cell-1' }),
      ],
    }
    expect(computeItemsState(blueprints, cellsByBlueprintId, itemsByBlueprintId)).toBe(
      'complete',
    )
  })

  it('returns complete when all cells exceed target', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = {
      'bp-1': [createCell({ id: 'cell-1', targetItemCount: 2 })],
    }
    const itemsByBlueprintId = {
      'bp-1': [
        createItem({ id: 'item-1', blueprintCellId: 'cell-1' }),
        createItem({ id: 'item-2', blueprintCellId: 'cell-1' }),
        createItem({ id: 'item-3', blueprintCellId: 'cell-1' }),
      ],
    }
    expect(computeItemsState(blueprints, cellsByBlueprintId, itemsByBlueprintId)).toBe(
      'complete',
    )
  })

  it('handles multiple blueprints with different states', () => {
    const blueprints = [
      createBlueprint({ id: 'bp-1' }),
      createBlueprint({ id: 'bp-2' }),
    ]
    const cellsByBlueprintId = {
      'bp-1': [createCell({ id: 'cell-1', targetItemCount: 2 })],
      'bp-2': [createCell({ id: 'cell-2', targetItemCount: 3 })],
    }
    // bp-1 meets target, bp-2 does not
    const itemsByBlueprintId = {
      'bp-1': [
        createItem({ id: 'item-1', blueprintCellId: 'cell-1' }),
        createItem({ id: 'item-2', blueprintCellId: 'cell-1' }),
      ],
      'bp-2': [createItem({ id: 'item-3', blueprintCellId: 'cell-2' })],
    }
    expect(computeItemsState(blueprints, cellsByBlueprintId, itemsByBlueprintId)).toBe(
      'needs_attention',
    )
  })
})

// ---------------------------------------------------------------------------
// Tests: computeEvidenceState
// ---------------------------------------------------------------------------

describe('computeEvidenceState', () => {
  it('returns not_started when no cells exist', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = { 'bp-1': [] }
    const itemsByBlueprintId = { 'bp-1': [] }
    expect(computeEvidenceState(blueprints, cellsByBlueprintId, itemsByBlueprintId, null)).toBe(
      'not_started',
    )
  })

  it('returns not_started when no items exist', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = { 'bp-1': [createCell()] }
    const itemsByBlueprintId = { 'bp-1': [] }
    expect(computeEvidenceState(blueprints, cellsByBlueprintId, itemsByBlueprintId, null)).toBe(
      'not_started',
    )
  })

  it('returns in_progress when items exist but no panel result', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = { 'bp-1': [createCell()] }
    const itemsByBlueprintId = { 'bp-1': [createItem()] }
    expect(computeEvidenceState(blueprints, cellsByBlueprintId, itemsByBlueprintId, null)).toBe(
      'in_progress',
    )
  })

  it('returns in_progress when panel result has no items', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = { 'bp-1': [createCell()] }
    const itemsByBlueprintId = { 'bp-1': [createItem()] }
    const panelResult = createPanelResult({ items: [] })
    expect(
      computeEvidenceState(blueprints, cellsByBlueprintId, itemsByBlueprintId, panelResult),
    ).toBe('in_progress')
  })

  it('returns needs_attention when accuracy below pass threshold (0.80)', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = { 'bp-1': [createCell()] }
    const itemsByBlueprintId = { 'bp-1': [createItem()] }
    const panelResult = createPanelResult({
      overall: {
        itemCount: 1,
        raterCount: 2,
        passRate: 0.5,
        meanAccuracy: 0.75, // Below 0.80 threshold
        meanAikenV: 0.70,
      },
    })
    expect(
      computeEvidenceState(blueprints, cellsByBlueprintId, itemsByBlueprintId, panelResult),
    ).toBe('needs_attention')
  })

  it('returns complete when accuracy meets pass threshold (0.80)', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = { 'bp-1': [createCell()] }
    const itemsByBlueprintId = { 'bp-1': [createItem()] }
    const panelResult = createPanelResult({
      overall: {
        itemCount: 1,
        raterCount: 2,
        passRate: 1.0,
        meanAccuracy: 0.80, // Meets 0.80 threshold
        meanAikenV: 0.80,
      },
    })
    expect(
      computeEvidenceState(blueprints, cellsByBlueprintId, itemsByBlueprintId, panelResult),
    ).toBe('complete')
  })

  it('returns complete when accuracy exceeds pass threshold', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = { 'bp-1': [createCell()] }
    const itemsByBlueprintId = { 'bp-1': [createItem()] }
    const panelResult = createPanelResult({
      overall: {
        itemCount: 1,
        raterCount: 2,
        passRate: 1.0,
        meanAccuracy: 0.95,
        meanAikenV: 0.95,
      },
    })
    expect(
      computeEvidenceState(blueprints, cellsByBlueprintId, itemsByBlueprintId, panelResult),
    ).toBe('complete')
  })
})

// ---------------------------------------------------------------------------
// Tests: computePublishState
// ---------------------------------------------------------------------------

describe('computePublishState', () => {
  it('returns not_started when evidence not complete', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = { 'bp-1': [createCell()] }
    const itemsByBlueprintId = { 'bp-1': [createItem()] }
    const panelResult = null
    expect(computePublishState(blueprints, cellsByBlueprintId, itemsByBlueprintId, panelResult)).toBe(
      'not_started',
    )
  })

  it('returns in_progress when evidence complete but no items published', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = { 'bp-1': [createCell()] }
    const itemsByBlueprintId = {
      'bp-1': [createItem({ publishedItemId: undefined })],
    }
    const panelResult = createPanelResult({
      overall: {
        itemCount: 1,
        raterCount: 2,
        passRate: 1.0,
        meanAccuracy: 0.85,
        meanAikenV: 0.85,
      },
    })
    expect(
      computePublishState(blueprints, cellsByBlueprintId, itemsByBlueprintId, panelResult),
    ).toBe('in_progress')
  })

  it('returns complete when evidence complete and items are published', () => {
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = { 'bp-1': [createCell()] }
    const itemsByBlueprintId = {
      'bp-1': [createItem({ publishedItemId: 'pub-1' })],
    }
    const panelResult = createPanelResult({
      overall: {
        itemCount: 1,
        raterCount: 2,
        passRate: 1.0,
        meanAccuracy: 0.85,
        meanAikenV: 0.85,
      },
    })
    expect(
      computePublishState(blueprints, cellsByBlueprintId, itemsByBlueprintId, panelResult),
    ).toBe('complete')
  })
})

// ---------------------------------------------------------------------------
// Tests: computeBuildProgress (integration)
// ---------------------------------------------------------------------------

describe('computeBuildProgress', () => {
  it('reports all steps not_started for empty build', () => {
    const build = createBuild({ brief: undefined })
    const blueprints: InstrumentBlueprintDto[] = []

    const progress = computeBuildProgress(build, blueprints, {}, {}, null)

    expect(progress.steps).toHaveLength(6)
    expect(progress.steps[0].state).toBe('not_started') // brief
    expect(progress.steps[1].state).toBe('not_started') // structure
    expect(progress.overallState).toBe('not_started')
    expect(progress.nextStep?.key).toBe('brief')
  })

  it('progresses through complete workflow', () => {
    // Setup complete workflow
    const build = createBuild({ brief: 'Measure leadership' })
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = {
      'bp-1': [createCell({ id: 'cell-1', targetItemCount: 2 })],
    }
    const itemsByBlueprintId = {
      'bp-1': [
        createItem({ id: 'item-1', blueprintCellId: 'cell-1' }),
        createItem({ id: 'item-2', blueprintCellId: 'cell-1' }),
      ],
    }
    const panelResult = createPanelResult({
      overall: {
        itemCount: 2,
        raterCount: 2,
        passRate: 1.0,
        meanAccuracy: 0.85,
        meanAikenV: 0.85,
      },
    })

    const progress = computeBuildProgress(
      build,
      blueprints,
      cellsByBlueprintId,
      itemsByBlueprintId,
      panelResult,
    )

    expect(progress.steps[0].state).toBe('complete') // brief
    expect(progress.steps[1].state).toBe('complete') // structure
    expect(progress.steps[2].state).toBe('complete') // blueprint
    expect(progress.steps[3].state).toBe('complete') // items
    expect(progress.steps[4].state).toBe('complete') // evidence
    expect(progress.steps[5].state).toBe('in_progress') // publish (not yet published)
  })

  it('reports needs_attention when items below target', () => {
    const build = createBuild({ brief: 'Measure leadership' })
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = {
      'bp-1': [createCell({ id: 'cell-1', targetItemCount: 5 })],
    }
    const itemsByBlueprintId = {
      'bp-1': [createItem({ id: 'item-1', blueprintCellId: 'cell-1' })],
    }

    const progress = computeBuildProgress(
      build,
      blueprints,
      cellsByBlueprintId,
      itemsByBlueprintId,
      null,
    )

    expect(progress.steps[3].state).toBe('needs_attention') // items
    expect(progress.overallState).toBe('needs_attention')
  })

  it('identifies correct next step', () => {
    const build = createBuild({ brief: 'Measure leadership' })
    const blueprints = [createBlueprint()]
    const cellsByBlueprintId = {
      'bp-1': [createCell({ id: 'cell-1', targetItemCount: 2 })],
    }
    const itemsByBlueprintId = {
      'bp-1': [
        createItem({ id: 'item-1', blueprintCellId: 'cell-1' }),
        createItem({ id: 'item-2', blueprintCellId: 'cell-1' }),
      ],
    }

    const progress = computeBuildProgress(
      build,
      blueprints,
      cellsByBlueprintId,
      itemsByBlueprintId,
      null,
    )

    expect(progress.nextStep?.key).toBe('evidence')
  })

  it('handles multiple blueprints', () => {
    const build = createBuild({ brief: 'Measure leadership' })
    const blueprints = [
      createBlueprint({ id: 'bp-1' }),
      createBlueprint({ id: 'bp-2' }),
    ]
    const cellsByBlueprintId = {
      'bp-1': [createCell({ id: 'cell-1' })],
      'bp-2': [createCell({ id: 'cell-2' })],
    }
    const itemsByBlueprintId = {
      'bp-1': [createItem({ id: 'item-1', blueprintCellId: 'cell-1' })],
      'bp-2': [createItem({ id: 'item-2', blueprintCellId: 'cell-2' })],
    }

    const progress = computeBuildProgress(
      build,
      blueprints,
      cellsByBlueprintId,
      itemsByBlueprintId,
      null,
    )

    expect(progress.steps[1].state).toBe('complete') // structure
  })
})
