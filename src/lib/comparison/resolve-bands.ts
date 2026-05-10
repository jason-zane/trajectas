import type { CSSProperties } from 'react'
import {
  resolveBandScheme,
  getBandColour,
  DEFAULT_3_BAND_SCHEME,
  type BandScheme,
} from '@/lib/reports/band-scheme'

export type BandResolverInput = {
  partner: { bandScheme: BandScheme | null } | null
  platform: { bandScheme: BandScheme | null }
}

export function buildCellStyleResolver(
  input: BandResolverInput,
): (score: number | null) => CSSProperties {
  const scheme = resolveBandScheme(
    null,
    input.partner ?? null,
    { bandScheme: input.platform.bandScheme ?? DEFAULT_3_BAND_SCHEME },
  )
  return (score) => {
    if (score === null || Number.isNaN(score)) return {}
    const clamped = Math.max(0, Math.min(100, score))
    const idx = scheme.bands.findIndex((b) => clamped >= b.min && clamped <= b.max)
    if (idx < 0) return {}
    return { backgroundColor: getBandColour(scheme.palette, idx, scheme.bands.length) }
  }
}
