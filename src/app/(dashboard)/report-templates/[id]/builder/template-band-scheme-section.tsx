'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { BandSchemeEditor } from '@/components/band-scheme-editor/band-scheme-editor'
import { SchemePreview } from '@/components/band-scheme-editor/scheme-preview'
import {
  getReportTemplateBandScheme,
  updateReportTemplateBandScheme,
} from '@/app/actions/reports'
import { getPlatformBandScheme } from '@/app/actions/platform-settings'
import { DEFAULT_3_BAND_SCHEME, type BandScheme } from '@/lib/reports/band-scheme'

interface Props {
  templateId: string
  onSchemeChange?: (scheme: BandScheme) => void
}

export function TemplateBandSchemeSection({ templateId, onSchemeChange }: Props) {
  const [templateScheme, setTemplateScheme] = useState<BandScheme | null>(null)
  const [inheritedScheme, setInheritedScheme] = useState<BandScheme | null>(null)
  const [mode, setMode] = useState<'inherit' | 'override'>('inherit')
  const [draft, setDraft] = useState<BandScheme | null>(null)
  const [isValid, setIsValid] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      getReportTemplateBandScheme(templateId),
      getPlatformBandScheme(),
    ]).then(([t, plat]) => {
      setTemplateScheme(t)
      setInheritedScheme(plat ?? DEFAULT_3_BAND_SCHEME)
      setMode(t ? 'override' : 'inherit')
      setLoaded(true)
    })
  }, [templateId])

  // Emit the effective scheme so the live preview can re-render as the user edits.
  useEffect(() => {
    if (!loaded || !onSchemeChange || !inheritedScheme) return
    if (mode === 'inherit') {
      onSchemeChange(inheritedScheme)
    } else {
      const effective = (isValid && draft) ? draft : (templateScheme ?? inheritedScheme)
      onSchemeChange(effective)
    }
  }, [loaded, mode, draft, isValid, templateScheme, inheritedScheme, onSchemeChange])

  async function handleSave() {
    setSaving(true)
    const scheme = mode === 'inherit' ? null : draft
    const result = await updateReportTemplateBandScheme(templateId, scheme)
    setSaving(false)
    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }
    setTemplateScheme(scheme)
    toast.success('Band scheme saved')
  }

  if (!loaded || !inheritedScheme) {
    return <p className="text-sm text-muted-foreground">Loading band scheme…</p>
  }

  const current = templateScheme ?? inheritedScheme

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-semibold">Band Scheme</Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Banding, labels, and palette used for scoring in this report. Inherits from the partner/platform unless overridden here.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={mode === 'inherit'}
            onChange={() => setMode('inherit')}
          />
          Inherit
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={mode === 'override'}
            onChange={() => setMode('override')}
          />
          Override
        </label>
      </div>

      {mode === 'inherit' ? (
        <SchemePreview scheme={inheritedScheme} />
      ) : (
        <BandSchemeEditor
          initial={current}
          onChange={(s, valid) => {
            setDraft(s)
            setIsValid(valid)
          }}
        />
      )}

      <Button
        onClick={handleSave}
        disabled={saving || (mode === 'override' && !isValid)}
        size="sm"
      >
        {saving ? 'Saving…' : 'Save band scheme'}
      </Button>
    </div>
  )
}
