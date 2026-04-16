'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { BandSchemeEditor } from '@/components/band-scheme-editor/band-scheme-editor'
import { getPlatformBandScheme, updatePlatformBandScheme } from '@/app/actions/platform-settings'
import { DEFAULT_3_BAND_SCHEME, type BandScheme } from '@/lib/reports/band-scheme'

export default function BandSchemePage() {
  const [initial, setInitial] = useState<BandScheme | null>(null)
  const [draft, setDraft] = useState<BandScheme | null>(null)
  const [isValid, setIsValid] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getPlatformBandScheme().then((s) => setInitial(s ?? DEFAULT_3_BAND_SCHEME))
  }, [])

  if (!initial) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>
  }

  async function handleSave() {
    if (!draft || !isValid) return
    setSaving(true)
    const result = await updatePlatformBandScheme(draft)
    setSaving(false)
    if ('error' in result && result.error) {
      toast.error(result.error)
    } else {
      toast.success('Band scheme saved')
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader
        title="Platform Band Scheme"
        description="Global default band configuration used when a partner or template doesn't override it."
      />
      <BandSchemeEditor
        initial={initial}
        onChange={(s, valid) => {
          setDraft(s)
          setIsValid(valid)
        }}
      />
      <Button onClick={handleSave} disabled={!isValid || saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )
}
