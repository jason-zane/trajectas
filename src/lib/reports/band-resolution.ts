// =============================================================================
// src/lib/reports/band-resolution.ts
// Scheme-based band resolution. Caller passes a resolved BandScheme.
// Entity-level overrides have been removed — all band configuration now lives
// at platform/partner/template level in the BandScheme cascade.
// =============================================================================

import type { BandResult } from './types'
import type { BandScheme } from './band-scheme'
import { DEFAULT_3_BAND_SCHEME } from './band-scheme'

export function resolveBand(pompScore: number, scheme: BandScheme = DEFAULT_3_BAND_SCHEME): BandResult {
  const rounded = Math.max(0, Math.min(100, Math.round(pompScore)))
  const bandIndex = scheme.bands.findIndex((b) => rounded >= b.min && rounded <= b.max)

  // Fallback: if score somehow doesn't fit any band (corrupted scheme),
  // use first or last band based on score position
  const safeIndex = bandIndex >= 0
    ? bandIndex
    : (rounded <= scheme.bands[0].min ? 0 : scheme.bands.length - 1)

  const band = scheme.bands[safeIndex]

  return {
    bandKey: band.key,
    bandLabel: band.label,
    bandIndex: safeIndex,
    bandCount: scheme.bands.length,
    indicatorTier: band.indicatorTier,
    pompScore: rounded,
  }
}
