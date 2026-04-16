// =============================================================================
// src/lib/reports/band-scheme-validation.ts
// Detailed validation with per-band errors for the editor UI
// =============================================================================

import type { BandScheme } from './band-scheme'

export interface BandValidationError {
  bandIndex: number   // -1 for scheme-level errors
  field: 'label' | 'min' | 'max' | 'indicatorTier' | 'coverage' | 'count'
  message: string
}

export function validateBandScheme(scheme: BandScheme): BandValidationError[] {
  const errors: BandValidationError[] = []
  const bands = scheme.bands ?? []

  if (bands.length < 2) {
    errors.push({ bandIndex: -1, field: 'count', message: 'Must have at least 2 bands' })
    return errors
  }
  if (bands.length > 10) {
    errors.push({ bandIndex: -1, field: 'count', message: 'Must have at most 10 bands' })
  }

  bands.forEach((band, i) => {
    if (!band.label?.trim()) {
      errors.push({ bandIndex: i, field: 'label', message: 'Label is required' })
    }
    if (typeof band.min !== 'number' || band.min < 0 || band.min > 100) {
      errors.push({ bandIndex: i, field: 'min', message: 'Min must be 0–100' })
    }
    if (typeof band.max !== 'number' || band.max < 0 || band.max > 100) {
      errors.push({ bandIndex: i, field: 'max', message: 'Max must be 0–100' })
    }
    if (band.max < band.min) {
      errors.push({ bandIndex: i, field: 'max', message: 'Max must be ≥ min' })
    }
    if (!['low', 'mid', 'high'].includes(band.indicatorTier)) {
      errors.push({ bandIndex: i, field: 'indicatorTier', message: 'Indicator tier is required' })
    }
  })

  const sorted = [...bands].sort((a, b) => a.min - b.min)
  if (sorted[0]?.min !== 0) {
    errors.push({ bandIndex: -1, field: 'coverage', message: 'First band must start at 0' })
  }
  if (sorted[sorted.length - 1]?.max !== 100) {
    errors.push({ bandIndex: -1, field: 'coverage', message: 'Last band must end at 100' })
  }
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    if (curr.min !== prev.max + 1) {
      errors.push({
        bandIndex: -1,
        field: 'coverage',
        message: `Gap or overlap between "${prev.label}" and "${curr.label}"`,
      })
    }
  }

  return errors
}

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function isSchemeValid(scheme: BandScheme): boolean {
  return validateBandScheme(scheme).length === 0
}
