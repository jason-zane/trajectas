'use client'

import { useState, useCallback } from 'react'
import type { BandScheme, BandDefinition, PaletteKey } from '@/lib/reports/band-scheme'
import { PRESETS } from '@/lib/reports/band-scheme'
import { slugify } from '@/lib/reports/band-scheme-validation'

export function useBandSchemeState(initial: BandScheme) {
  const [scheme, setScheme] = useState<BandScheme>(initial)

  const loadPreset = useCallback((presetKey: keyof typeof PRESETS) => {
    // Deep clone so mutations don't leak back into the preset object
    setScheme(JSON.parse(JSON.stringify(PRESETS[presetKey])) as BandScheme)
  }, [])

  const setPalette = useCallback((palette: PaletteKey) => {
    setScheme((s) => ({ ...s, palette }))
  }, [])

  const updateBand = useCallback((index: number, patch: Partial<BandDefinition>) => {
    setScheme((s) => {
      const bands = [...s.bands]
      const next = { ...bands[index], ...patch }
      // Auto-slug key from label whenever label changes
      if (patch.label !== undefined) next.key = slugify(patch.label) || `band_${index + 1}`
      bands[index] = next
      return { ...s, bands }
    })
  }, [])

  const addBand = useCallback(() => {
    setScheme((s) => {
      const lastMax = s.bands[s.bands.length - 1]?.max ?? -1
      if (lastMax >= 100) return s
      const newBand: BandDefinition = {
        key: `band_${s.bands.length + 1}`,
        label: `Band ${s.bands.length + 1}`,
        min: lastMax + 1,
        max: 100,
        indicatorTier: 'mid',
      }
      return { ...s, bands: [...s.bands, newBand] }
    })
  }, [])

  const removeBand = useCallback((index: number) => {
    setScheme((s) => {
      if (s.bands.length <= 2) return s
      const bands = s.bands.filter((_, i) => i !== index)
      return { ...s, bands }
    })
  }, [])

  return { scheme, setScheme, loadPreset, setPalette, updateBand, addBand, removeBand }
}
