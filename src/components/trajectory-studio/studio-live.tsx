'use client'

import { useEffect, useState, useTransition } from 'react'
import { Check, Search } from 'lucide-react'
import { toast } from 'sonner'
import { getComparisonCanvas } from '@/app/actions/canvas'
import { searchWorkspaceParticipants, type ParticipantSearchHit } from '@/app/actions/comparison'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EmptyState } from '@/components/empty-state'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { CanvasResult } from '@/lib/canvas/types'
import type { Experience, Lens } from '@/lib/trajectory-studio/model'
import { TrajectoryStudio } from './trajectory-studio'
import { Button } from '@/components/ui/button'
import styles from './studio.module.css'

export function LiveTrajectoryStudio({ initial, experience, initialLens, nonce }: { initial: CanvasResult; experience: Experience; initialLens?: Lens; nonce?: string }) {
  const individual = experience === 'individual'
  const [result, setResult] = useState(initial)
  const [activeLens, setActiveLens] = useState(initialLens)
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>(initial.people.map((p) => p.entryCpId))
  const [query, setQuery] = useState('')
  const [campaign, setCampaign] = useState('all')
  const [hits, setHits] = useState<ParticipantSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setSearching(true); setError(null)
      try { const rows = await searchWorkspaceParticipants(query); if (!cancelled) setHits(rows) }
      catch { if (!cancelled) { setHits([]); setError('Participants could not be loaded. Try searching again.') } }
      finally { if (!cancelled) setSearching(false) }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [open, query])

  function loadSelection() {
    startTransition(async () => {
      setError(null)
      try {
        const next = await getComparisonCanvas(picked)
        setResult(next); setOpen(false)
        const url = new URL(window.location.href)
        setActiveLens(url.searchParams.get('lens') === 'time' ? 'time' : 'snapshot')
        url.searchParams.set('ids', next.people.map((p) => p.entryCpId).join(','))
        window.history.replaceState(null, '', url)
        toast.success(`${next.people.length} people loaded`, { description: 'Linked campaign records have been grouped by person.' })
      } catch { const message = 'Results could not be loaded. Check your selection and try again.'; setError(message); toast.error(message) }
    })
  }

  const campaigns = [...new Map(hits.map((h) => [h.campaignId, h.campaignTitle])).entries()]
  const filtered = hits.filter((hit) => campaign === 'all' || hit.campaignId === campaign)
  return <>
    <TrajectoryStudio key={result.people.map((p) => p.personKey).join(',')} dataset={{ result, workspaceName: 'Current workspace', demo: false }} nonce={nonce} initialExperience={experience} initialLens={activeLens} onBrowse={() => { setPicked(result.people.map((p) => p.entryCpId)); setOpen(true); setCampaign('all'); setQuery(''); setError(null) }} />
    <Dialog open={open} onOpenChange={(value) => { if (!pending) setOpen(value) }}><DialogContent className={`${styles.dialog} ${styles.participantDialog} sm:max-w-2xl`}><div className={styles.participantDialogHeader}><DialogHeader><DialogTitle>Choose participants from your workspace</DialogTitle><DialogDescription>Search people and filter by campaign. Each record shows its completed assessments; linked identities are combined when loaded. {individual ? 'Choose one person to explore their history.' : 'Up to eight records per selection.'}</DialogDescription></DialogHeader>
      <div className={styles.search}><Search size={16} /><input aria-label="Search workspace participants" type="search" value={query} onChange={(e) => { setQuery(e.target.value); setCampaign('all') }} placeholder="Search name or email…" /></div>
      <label className={styles.field}><span>Campaign</span><select aria-label="Filter search by campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)}><option value="all">All campaigns in these search results</option>{campaigns.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div aria-live="polite" className={styles.finePrint}>{searching ? 'Searching…' : `${filtered.length} records found · ${picked.length} selected`}</div></div>
      <div className={styles.participantDialogResults} role="region" aria-label="Workspace participant results" tabIndex={0}><div className={styles.peopleList}>{filtered.map((hit) => <button className={`${styles.personOption} ${picked.includes(hit.id) ? styles.personSelected : ''}`} key={hit.id} aria-pressed={picked.includes(hit.id)} disabled={pending || (!individual && !picked.includes(hit.id) && picked.length >= 8) || hit.completedSessionCount === 0} onClick={() => setPicked((old) => old.includes(hit.id) ? old.filter((id) => id !== hit.id) : individual ? [hit.id] : [...old, hit.id])}><span className={styles.personText}><strong>{hit.name}</strong><span>{hit.email} · {hit.campaignTitle}</span><small>{hit.completedSessionCount} completed assessments</small></span><span className={styles.checkBox}>{picked.includes(hit.id) && <Check size={12} />}</span></button>)}</div>
      {!searching && !filtered.length && !error && <EmptyState size="sm" title="No participants found" description="Try another name or campaign filter." />}</div>
      <div className={styles.participantDialogFooter}><p className={styles.finePrint}>Loading a new group starts a fresh analysis. Save your current view before changing groups if you want to return to it.</p>
      <Button disabled={!picked.length || pending || searching} onClick={loadSelection}>{pending ? 'Loading results…' : `Load ${picked.length} selected records`}</Button></div>
    </DialogContent></Dialog>
  </>
}
