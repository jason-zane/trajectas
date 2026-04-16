// =============================================================================
// src/lib/reports/band-scheme.ts
// Types, presets, palettes, and cascade resolution for custom band schemes
// =============================================================================

export type IndicatorTier = 'low' | 'mid' | 'high'
export type PaletteKey = 'red-amber-green' | 'warm-neutral' | 'monochrome' | 'blue-scale'

export interface BandDefinition {
  key: string
  label: string
  min: number
  max: number
  indicatorTier: IndicatorTier
}

export interface BandScheme {
  palette: PaletteKey
  bands: BandDefinition[]
}

// ---------------------------------------------------------------------------
// Presets — starting points that users can customise
// ---------------------------------------------------------------------------

export const PRESETS: Record<string, BandScheme> = {
  '3-band': {
    palette: 'red-amber-green',
    bands: [
      { key: 'developing', label: 'Developing', min: 0, max: 40, indicatorTier: 'low' },
      { key: 'effective', label: 'Effective', min: 41, max: 69, indicatorTier: 'mid' },
      { key: 'highly_effective', label: 'Highly Effective', min: 70, max: 100, indicatorTier: 'high' },
    ],
  },
  '5-band': {
    palette: 'red-amber-green',
    bands: [
      { key: 'emerging', label: 'Emerging', min: 0, max: 20, indicatorTier: 'low' },
      { key: 'developing', label: 'Developing', min: 21, max: 40, indicatorTier: 'low' },
      { key: 'competent', label: 'Competent', min: 41, max: 60, indicatorTier: 'mid' },
      { key: 'effective', label: 'Effective', min: 61, max: 80, indicatorTier: 'high' },
      { key: 'highly_effective', label: 'Highly Effective', min: 81, max: 100, indicatorTier: 'high' },
    ],
  },
  '7-band': {
    palette: 'red-amber-green',
    bands: [
      { key: 'very_low', label: 'Very Low', min: 0, max: 14, indicatorTier: 'low' },
      { key: 'low', label: 'Low', min: 15, max: 28, indicatorTier: 'low' },
      { key: 'below_average', label: 'Below Average', min: 29, max: 42, indicatorTier: 'low' },
      { key: 'average', label: 'Average', min: 43, max: 57, indicatorTier: 'mid' },
      { key: 'above_average', label: 'Above Average', min: 58, max: 71, indicatorTier: 'high' },
      { key: 'high', label: 'High', min: 72, max: 85, indicatorTier: 'high' },
      { key: 'very_high', label: 'Very High', min: 86, max: 100, indicatorTier: 'high' },
    ],
  },
}

export const DEFAULT_3_BAND_SCHEME: BandScheme = PRESETS['3-band']

// ---------------------------------------------------------------------------
// Palettes — colour derivation
// ---------------------------------------------------------------------------

const PALETTE_STOPS: Record<PaletteKey, [string, string]> = {
  'red-amber-green': ['#c62828', '#2e7d32'],
  'warm-neutral': ['#8a7a5a', '#c9a962'],
  'monochrome': ['#6b6b6b', '#1a1a1a'],
  'blue-scale': ['#90caf9', '#0d47a1'],
}

/**
 * Derive a colour for a band given the palette and its position.
 * For red-amber-green specifically, we interpolate through amber in the middle.
 * Other palettes linearly interpolate between start and end stops.
 */
export function getBandColour(palette: PaletteKey, bandIndex: number, bandCount: number): string {
  if (bandCount <= 1) return PALETTE_STOPS[palette][0]
  const t = bandIndex / (bandCount - 1)

  if (palette === 'red-amber-green') {
    if (t < 0.5) {
      return interpolateHex('#c62828', '#e67a00', t * 2)
    }
    return interpolateHex('#e67a00', '#2e7d32', (t - 0.5) * 2)
  }

  const [start, end] = PALETTE_STOPS[palette]
  return interpolateHex(start, end, t)
}

function interpolateHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16)
  const ag = parseInt(a.slice(3, 5), 16)
  const ab = parseInt(a.slice(5, 7), 16)
  const br = parseInt(b.slice(1, 3), 16)
  const bg = parseInt(b.slice(3, 5), 16)
  const bb = parseInt(b.slice(5, 7), 16)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Cascade resolution — template → partner → platform → default fallback
// ---------------------------------------------------------------------------

export function resolveBandScheme(
  template: { bandScheme?: BandScheme | null } | null,
  partner: { bandScheme?: BandScheme | null } | null,
  platform: { bandScheme?: BandScheme | null } | null,
): BandScheme {
  const candidates = [template?.bandScheme, partner?.bandScheme, platform?.bandScheme]
  for (const c of candidates) {
    if (c && isStructurallyValid(c)) return c
  }
  return DEFAULT_3_BAND_SCHEME
}

/**
 * Lightweight validation used by resolveBandScheme — catches corrupted/malformed
 * schemes stored in the DB. Full validation with error messages lives in
 * band-scheme-validation.ts for the editor UI.
 */
function isStructurallyValid(scheme: BandScheme): boolean {
  if (!scheme.bands || scheme.bands.length < 2) return false
  const sorted = [...scheme.bands].sort((a, b) => a.min - b.min)
  if (sorted[0].min !== 0) return false
  if (sorted[sorted.length - 1].max !== 100) return false
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].min !== sorted[i - 1].max + 1) return false
  }
  for (const b of sorted) {
    if (!b.label || !b.key || !b.indicatorTier) return false
  }
  return true
}
