'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ActionDialog, ActionDialogBody, ActionDialogFooter } from '@/components/action-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { refreshNormReference } from '@/app/actions/norm-references'
import type { ReferenceOption } from '@/lib/norms/types'

export function ReferenceRefreshDialog({ reference, onClose }: { reference: ReferenceOption | null; onClose: () => void }) {
  const router = useRouter()
  const [version, setVersion] = useState('')
  const [artifact, setArtifact] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [attribution, setAttribution] = useState('')
  const [collectionPeriod, setCollectionPeriod] = useState('')
  const [notes, setNotes] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [id] = useState(() => crypto.randomUUID())
  return <ActionDialog open={Boolean(reference)} onOpenChange={open => { if (!open && !pending) onClose() }} title="Create a norm group version" description={reference ? `${reference.name} · Current version ${reference.version}` : undefined}>
    <form onSubmit={async event => {
      event.preventDefault()
      if (!reference || pending) return
      setPending(true); setError(null)
      try {
        await refreshNormReference({ priorId: reference.id, id, version, artifact, sourceUrl, attribution, collectionPeriod, notes })
        toast.success('Draft norm group version created'); onClose(); router.refresh()
      } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create the version') }
      finally { setPending(false) }
    }}>
      <ActionDialogBody>
        <Alert variant="info"><AlertDescription>Upload a refreshed aggregate distribution for this same population. The new version starts in draft for source and method review. Campaigns and saved reports keep their current version.</AlertDescription></Alert>
        <label className="block space-y-2 text-sm font-medium"><span>New version</span><Input required maxLength={100} disabled={pending} value={version} placeholder="For example, 2027-01-v1" onChange={event => setVersion(event.target.value)} /></label>
        <label className="block space-y-2 text-sm font-medium"><span>Aggregate distribution file</span><Input required disabled={pending} type="file" accept=".json,application/json" onChange={async event => {
          const file = event.target.files?.[0]
          setArtifact(''); setError(null)
          if (!file) return
          if (file.size > 200_000) { setError('Upload one aggregate group smaller than 200 KB.'); return }
          try { setArtifact(await file.text()) } catch { setError('The file could not be read. Choose it again.') }
        }} /></label>
        <p className="text-caption text-muted-foreground">One JSON group with id, label, rawN, kishEffectiveN, ageBoundsInclusive, countryLabels, weighting and nativeScoreMass for all 35 scales. Upload aggregated probabilities; participant records are not accepted.</p>
        <label className="block space-y-2 text-sm font-medium"><span>Source publication</span><Input required type="url" disabled={pending} value={sourceUrl} placeholder="https://…" onChange={event => setSourceUrl(event.target.value)} /></label>
        <label className="block space-y-2 text-sm font-medium"><span>Data collection period</span><Input required minLength={4} maxLength={100} disabled={pending} value={collectionPeriod} placeholder="For example, January–December 2026" onChange={event => setCollectionPeriod(event.target.value)} /></label>
        <label className="block space-y-2 text-sm font-medium"><span>Attribution and licence</span><Textarea required minLength={10} maxLength={1500} disabled={pending} value={attribution} onChange={event => setAttribution(event.target.value)} /></label>
        <label className="block space-y-2 text-sm font-medium"><span>What changed and why</span><Textarea required minLength={20} maxLength={3000} disabled={pending} value={notes} placeholder="Collection period, eligibility, exclusions, preparation method and validation evidence." onChange={event => setNotes(event.target.value)} /></label>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      </ActionDialogBody>
      <ActionDialogFooter><Button type="button" variant="ghost" disabled={pending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending || !artifact || !version.trim() || !sourceUrl || attribution.trim().length < 10 || notes.trim().length < 20}>{pending ? 'Creating…' : 'Create draft version'}</Button></ActionDialogFooter>
    </form>
  </ActionDialog>
}
