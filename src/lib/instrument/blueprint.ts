/**
 * Test blueprint logic — table of specifications for item generation.
 *
 * A blueprint defines target coverage across facets and intensity levels,
 * audits actual item assignment, and guides proportional allocation.
 *
 * @module
 */

import type { BlueprintCell, Intensity, CoverageReport } from './types'

export const DEFAULT_SECONDS_PER_ITEM = 12

// ---------------------------------------------------------------------------
// Aggregation functions
// ---------------------------------------------------------------------------

export function totalTargetItems(cells: BlueprintCell[]): number {
  return cells.reduce((sum, cell) => sum + cell.targetItemCount, 0)
}

export function facetCount(cells: BlueprintCell[]): number {
  const facets = new Set(cells.map(c => c.facetLabel))
  return facets.size
}

export function intensitySpread(cells: BlueprintCell[]): Record<Intensity, number> {
  const spread: Record<Intensity, number> = { low: 0, mid: 0, high: 0 }
  for (const cell of cells) {
    spread[cell.intensity] += cell.targetItemCount
  }
  return spread
}

// ---------------------------------------------------------------------------
// Coverage audit
// ---------------------------------------------------------------------------

export function auditCoverage(
  cells: BlueprintCell[],
  items: Array<{ id: string; blueprintCellId?: string | null }>
): CoverageReport {
  // Count actual items per cell
  const cellCounts: Record<string, number> = {}
  let unassignedItemCount = 0

  for (const item of items) {
    if (item.blueprintCellId) {
      cellCounts[item.blueprintCellId] = (cellCounts[item.blueprintCellId] || 0) + 1
    } else {
      unassignedItemCount++
    }
  }

  // Build cell-by-cell report
  const cellReports = cells.map(cell => {
    const actual = cellCounts[cell.id] || 0
    const target = cell.targetItemCount
    const deficit = Math.max(0, target - actual)
    const surplus = Math.max(0, actual - target)

    let status: 'empty' | 'under' | 'met' | 'over'
    if (actual === 0) {
      status = 'empty'
    } else if (actual < target) {
      status = 'under'
    } else if (actual === target) {
      status = 'met'
    } else {
      status = 'over'
    }

    return {
      cellId: cell.id,
      facetLabel: cell.facetLabel,
      intensity: cell.intensity,
      target,
      actual,
      deficit,
      surplus,
      status
    }
  })

  const totalTarget = totalTargetItems(cells)
  const totalActual = items.length - unassignedItemCount
  const emptyCells = cellReports.filter(r => r.status === 'empty').length
  const underfilledCells = cellReports.filter(r => r.status === 'under').length
  const isComplete = emptyCells === 0 && underfilledCells === 0

  return {
    cells: cellReports,
    unassignedItemCount,
    totalTarget,
    totalActual,
    emptyCells,
    underfilledCells,
    isComplete
  }
}

// ---------------------------------------------------------------------------
// Respondent burden
// ---------------------------------------------------------------------------

export function estimateBurdenSeconds(
  itemCount: number,
  secondsPerItem: number = DEFAULT_SECONDS_PER_ITEM
): number {
  return itemCount * secondsPerItem
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateBlueprint(cells: BlueprintCell[]): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Error: no cells at all
  if (cells.length === 0) {
    errors.push('Blueprint has no cells')
    return { valid: false, errors, warnings }
  }

  // Error: duplicate facet + intensity pairs, empty facetLabel, or invalid targetItemCount
  const pairs = new Set<string>()
  for (const cell of cells) {
    if (!cell.facetLabel || cell.facetLabel.trim() === '') {
      errors.push(`Cell ${cell.id} has empty facetLabel`)
      continue
    }
    if (cell.targetItemCount < 1) {
      errors.push(
        `Cell ${cell.id} (${cell.facetLabel}, ${cell.intensity}) has targetItemCount < 1`
      )
      continue
    }
    const key = `${cell.facetLabel}|${cell.intensity}`
    if (pairs.has(key)) {
      errors.push(
        `Duplicate blueprint cell: facetLabel="${cell.facetLabel}", intensity="${cell.intensity}"`
      )
    } else {
      pairs.add(key)
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  // Warning: facet with only one intensity level
  const facetIntensities: Record<string, Set<Intensity>> = {}
  for (const cell of cells) {
    if (!facetIntensities[cell.facetLabel]) {
      facetIntensities[cell.facetLabel] = new Set()
    }
    facetIntensities[cell.facetLabel].add(cell.intensity)
  }
  for (const [facet, intensities] of Object.entries(facetIntensities)) {
    if (intensities.size === 1) {
      warnings.push(`Facet "${facet}" has only one intensity level`)
    }
  }

  // Warning: total target < 4 items
  const total = totalTargetItems(cells)
  if (total < 4) {
    warnings.push(
      `Total target items (${total}) is less than 4; Cronbach's alpha will be unstable`
    )
  }

  // Warning: more than 8 facets
  const facetCount_ = facetCount(cells)
  if (facetCount_ > 8) {
    warnings.push(`Blueprint has ${facetCount_} facets; construct may be too broad`)
  }

  // Warning: total > 30 items
  if (total > 30) {
    warnings.push(
      `Total target items (${total}) exceeds 30; consider reducing respondent burden`
    )
  }

  return { valid: true, errors, warnings }
}

// ---------------------------------------------------------------------------
// Allocation
// ---------------------------------------------------------------------------

export function allocateTargets(totalItems: number, cells: BlueprintCell[]): BlueprintCell[] {
  if (cells.length === 0) {
    return []
  }

  const currentTotal = totalTargetItems(cells)

  if (totalItems < cells.length) {
    // Can't give each cell 1; return unchanged (caller should validate)
    return cells
  }

  // Allocate proportionally based on current distribution
  const allocations = cells.map(cell => ({
    cell,
    proportion: currentTotal > 0 ? cell.targetItemCount / currentTotal : 1 / cells.length,
    baseAllocation: 0
  }))

  // Compute base allocations (floor), ensuring each >= 1
  let totalAllocated = 0
  for (const alloc of allocations) {
    alloc.baseAllocation = Math.max(1, Math.floor(alloc.proportion * totalItems))
    totalAllocated += alloc.baseAllocation
  }

  // Distribute remainder (sort by displayOrder to give earliest cells any extra)
  let remainder = totalItems - totalAllocated
  const sorted = allocations.sort((a, b) => a.cell.displayOrder - b.cell.displayOrder)
  for (const alloc of sorted) {
    if (remainder <= 0) break
    alloc.baseAllocation += 1
    remainder--
  }

  return sorted.map(a => ({
    ...a.cell,
    targetItemCount: a.baseAllocation
  }))
}
