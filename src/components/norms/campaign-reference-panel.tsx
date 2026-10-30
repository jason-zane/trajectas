'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ActionDialog, ActionDialogBody, ActionDialogFooter } from '@/components/action-dialog'
import { ReferenceChooser } from './reference-chooser'
import { setCampaignAssessmentReference } from '@/app/actions/norm-references'
import type { getCampaignReferenceSettings } from '@/lib/dal/norm-references'

type Settings = Awaited<ReturnType<typeof getCampaignReferenceSettings>>
export function CampaignReferencePanel({ campaignId, settings }: { campaignId: string; settings: Settings }) {
  const [editing, setEditing] = useState<Settings['assessments'][number] | null>(null)
  const [value, setValue] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  return <section className="space-y-4">
    <div><h2 className="text-xl font-semibold">Reporting references</h2><p className="mt-1 text-sm text-muted-foreground">Each assessment has its own compatible reference. Campaign references are fixed at launch; other comparisons can be created as additional reports.</p></div>
    {settings.locked && <Alert variant="info"><AlertDescription>These campaign references are frozen. Create another report from a completed assessment to use a different reference.</AlertDescription></Alert>}
    <div className="divide-y divide-border rounded-lg border border-border">
      {settings.assessments.map(a => <div key={a.campaignAssessmentId} className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0"><p className="font-medium">{a.title}</p><p className="mt-1 text-sm text-muted-foreground">{a.referenceVersionId ? a.references.find(r => r.id === a.referenceVersionId)?.name ?? 'Selected reference unavailable' : 'Scale scores only · no norm comparison'}</p></div>
        <Button variant="outline" size="sm" disabled={settings.locked || !settings.canManage} onClick={() => { setEditing(a); setValue(a.referenceVersionId); setError(null) }}>Choose reference</Button>
      </div>)}
      {!settings.assessments.length && <p className="p-4 text-sm text-muted-foreground">Add an assessment to configure its reporting reference.</p>}
    </div>
    <ActionDialog open={Boolean(editing)} onOpenChange={open => { if (!open) setEditing(null) }} title="Choose reporting reference" description={editing?.title}>
      <ActionDialogBody>
        {editing && <ReferenceChooser references={editing.references} value={value} onChange={setValue} disabled={pending} />}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      </ActionDialogBody>
      <ActionDialogFooter><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={pending || !editing} onClick={() => start(async () => {
        if (!editing) return
        try { await setCampaignAssessmentReference({ campaignId, campaignAssessmentId: editing.campaignAssessmentId, referenceId: value }); toast.success('Campaign reference saved'); setEditing(null); router.refresh() }
        catch (e) { const message = e instanceof Error ? e.message : 'Unable to save reference'; setError(message); toast.error(message) }
      })}>{pending ? 'Saving…' : 'Save reference'}</Button></ActionDialogFooter>
    </ActionDialog>
  </section>
}
