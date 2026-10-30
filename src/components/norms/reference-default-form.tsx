'use client'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ReferenceChooser } from './reference-chooser'
import { setAssessmentReferenceDefault } from '@/app/actions/norm-references'
import type { ReferenceOption } from '@/lib/norms/types'

export function ReferenceDefaultForm({ assessmentId, references }: { assessmentId: string; references: ReferenceOption[] }) {
  const [value, setValue] = useState<string | null>(references.find(r => r.isDefault)?.id ?? null)
  const [saved, setSaved] = useState(value)
  const unsaved = useUnsavedChanges(value !== saved)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  return <div className="max-w-2xl space-y-5">
    <div><h2 className="text-xl font-semibold">Default reporting reference</h2><p className="mt-2 text-sm text-muted-foreground">New campaigns can start with this reference. Existing campaigns and saved reports keep their selected version.</p></div>
    <ReferenceChooser references={references} value={value} onChange={setValue} disabled={pending} />
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <Button disabled={pending || value === saved} onClick={() => start(async () => {
      setError(null)
      try { await setAssessmentReferenceDefault({ assessmentId, referenceId: value }); setSaved(value); toast.success('Reference default saved'); router.refresh() }
      catch (e) { const message = e instanceof Error ? e.message : 'Unable to save the reference'; setError(message); toast.error(message) }
    })}>{pending ? 'Saving…' : 'Save default'}</Button>
    <ConfirmDialog open={unsaved.showDialog} onOpenChange={open => { if (!open) unsaved.cancelNavigation() }} title="Discard unsaved reference?" description="Your assessment default has not been saved." confirmLabel="Discard changes" onConfirm={unsaved.confirmNavigation} />
  </div>
}
