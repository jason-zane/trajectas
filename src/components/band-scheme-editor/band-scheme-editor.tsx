'use client'

import { useMemo, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { PRESETS, type BandScheme, type PaletteKey } from '@/lib/reports/band-scheme'
import { validateBandScheme } from '@/lib/reports/band-scheme-validation'
import { useBandSchemeState } from './use-band-scheme-state'
import { BandRow } from './band-row'
import { SchemePreview } from './scheme-preview'

const PALETTES: { value: PaletteKey; label: string }[] = [
  { value: 'red-amber-green', label: 'Red-Amber-Green' },
  { value: 'warm-neutral', label: 'Warm Neutral' },
  { value: 'monochrome', label: 'Monochrome' },
  { value: 'blue-scale', label: 'Blue Scale' },
]

interface BandSchemeEditorProps {
  initial: BandScheme
  onChange: (scheme: BandScheme, isValid: boolean) => void
}

export function BandSchemeEditor({ initial, onChange }: BandSchemeEditorProps) {
  const { scheme, loadPreset, setPalette, updateBand, addBand, removeBand } = useBandSchemeState(initial)
  const errors = useMemo(() => validateBandScheme(scheme), [scheme])
  const schemeErrors = errors.filter((e) => e.bandIndex === -1)
  const lastMax = scheme.bands[scheme.bands.length - 1]?.max ?? 0
  const canAdd = scheme.bands.length < 10 && lastMax < 100

  // Notify parent on every change
  useEffect(() => {
    onChange(scheme, errors.length === 0)
  }, [scheme, errors, onChange])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Preset</Label>
          <Select onValueChange={(v) => loadPreset(v as keyof typeof PRESETS)}>
            <SelectTrigger className="h-8 w-32 text-sm"><SelectValue placeholder="Load preset" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3-band">3-band</SelectItem>
              <SelectItem value="5-band">5-band</SelectItem>
              <SelectItem value="7-band">7-band</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Palette</Label>
          <Select value={scheme.palette} onValueChange={(v) => setPalette(v as PaletteKey)}>
            <SelectTrigger className="h-8 w-40 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PALETTES.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        {scheme.bands.map((band, i) => (
          <BandRow
            key={i}
            band={band}
            index={i}
            bandCount={scheme.bands.length}
            palette={scheme.palette}
            errors={errors}
            canRemove={scheme.bands.length > 2}
            onUpdate={(patch) => updateBand(i, patch)}
            onRemove={() => removeBand(i)}
          />
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addBand} disabled={!canAdd}>
        <Plus className="size-4 mr-1" />
        Add band
      </Button>

      {schemeErrors.length > 0 && (
        <ul className="text-xs text-destructive space-y-0.5">
          {schemeErrors.map((e, i) => <li key={i}>{e.message}</li>)}
        </ul>
      )}

      <SchemePreview scheme={scheme} />
    </div>
  )
}
