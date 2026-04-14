// =============================================================================
// src/lib/reports/band-resolution.ts
// Resolves a POMP score to a band result using the hierarchy:
//   1. (Future) norm-derived thresholds
//   2. Entity override (band_label_* / pomp_threshold_* on dimension/factor/construct)
//   3. Global default (stored in partner config or hardcoded defaults)
// =============================================================================

import type { Band, BandResult } from './types'

export interface BandEntity {
  bandLabelLow?: string
  bandLabelMid?: string
  bandLabelHigh?: string
  pompThresholdLow?: number
  pompThresholdHigh?: number
}

export interface GlobalBandDefaults {
  thresholdLow: number   // POMP upper boundary for low band (default 40)
  thresholdHigh: number  // POMP lower boundary for high band (default 70)
  labelLow: string       // default "Developing"
  labelMid: string       // default "Effective"
  labelHigh: string      // default "Highly Effective"
}

export const DEFAULT_BAND_GLOBALS: GlobalBandDefaults = {
  thresholdLow: 40,
  thresholdHigh: 70,
  labelLow: 'Developing',
  labelMid: 'Effective',
  labelHigh: 'Highly Effective',
}

export function resolveBand(
  pompScore: number,
  entity: BandEntity,
  globals: GlobalBandDefaults = DEFAULT_BAND_GLOBALS,
): BandResult {
  const thresholdLow = entity.pompThresholdLow ?? globals.thresholdLow
  const thresholdHigh = entity.pompThresholdHigh ?? globals.thresholdHigh

  let band: Band
  if (pompScore <= thresholdLow) {
    band = 'low'
  } else if (pompScore >= thresholdHigh) {
    band = 'high'
  } else {
    band = 'mid'
  }

  const bandLabel =
    band === 'low'
      ? (entity.bandLabelLow ?? globals.labelLow)
      : band === 'high'
        ? (entity.bandLabelHigh ?? globals.labelHigh)
        : (entity.bandLabelMid ?? globals.labelMid)

  return { band, bandLabel, pompScore: Math.round(pompScore), thresholdLow, thresholdHigh }
}
