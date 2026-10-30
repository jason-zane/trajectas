'use client'
import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { DataTable } from '@/components/data-table'
import { ActionDialog, ActionDialogBody, ActionDialogFooter } from '@/components/action-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ReferenceChooser } from './reference-chooser'
import { createReferenceReportEdition, selectParticipantReportEdition, type getSessionReferenceWorkspace } from '@/app/actions/norm-references'
import { retrySnapshot, releaseSnapshot } from '@/app/actions/reports'

type Workspace = Awaited<ReturnType<typeof getSessionReferenceWorkspace>>
type Edition = Workspace['history'][number]
export function ReportEditions({ sessionId, workspace, reportBasePath }: { sessionId: string; workspace: Workspace; reportBasePath: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [referenceId, setReferenceId] = useState<string | null>(workspace.campaignReferenceId)
  const [templateId, setTemplateId] = useState(workspace.templates[0]?.id ?? '')
  const [requestId, setRequestId] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const hasPending = workspace.history.some(r => r.status === 'pending' || r.status === 'generating')
  useEffect(() => { if (!hasPending) return; const timer = setInterval(() => router.refresh(), 5000); return () => clearInterval(timer) }, [hasPending, router])
  async function action(fn: () => Promise<void>, message: string) {
    try { await fn(); toast.success(message); router.refresh() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to update report') }
  }
  const columns: ColumnDef<Edition>[] = [
    { accessorKey: 'templateName', header: 'Report', cell: ({ row }) => <div><p className="font-medium">{row.original.templateName}</p><p className="text-caption text-muted-foreground">Edition {row.original.edition}</p></div> },
    { accessorKey: 'referenceName', header: 'Reference', cell: ({ row }) => <div className="max-w-xs"><p>{row.original.referenceName ?? 'Scale scores only'}</p>{row.original.referenceVersion && <p className="text-caption text-muted-foreground">{row.original.referenceVersion}</p>}{row.original.referenceStatus === 'withdrawn' && <Badge variant="destructive">Reference withdrawn</Badge>}</div> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <div className="space-y-1"><Badge variant="outline">{row.original.status}</Badge>{row.original.participantSelected && row.original.status === 'released' && <p className="text-caption text-muted-foreground">Selected for participant access</p>}{row.original.errorMessage && <p className="max-w-xs text-caption text-destructive">{row.original.errorMessage}</p>}</div> },
    { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => <span className="text-caption tabular-nums">{new Date(row.original.createdAt).toLocaleDateString('en-AU')}</span> },
    { id: 'actions', cell: ({ row }) => <div className="flex flex-wrap gap-2">
      {(row.original.status === 'released' || (row.original.status === 'ready' && workspace.canCreate)) && <Link href={`${reportBasePath}/${row.original.id}`} className="text-sm font-medium text-primary underline underline-offset-4">Open report</Link>}
      {workspace.canCreate && row.original.status === 'failed' && <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => action(() => retrySnapshot(row.original.id), 'Report queued for retry'))}>Retry</Button>}
      {workspace.canCreate && row.original.status === 'ready' && <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => action(() => releaseSnapshot(row.original.id), 'Report released'))}>Release</Button>}
      {workspace.canCreate && row.original.status === 'released' && !row.original.participantSelected && <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => action(() => selectParticipantReportEdition(row.original.id), 'Participant report selected'))}>Use for participant access</Button>}
    </div> },
  ]
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-sm text-muted-foreground">Each report keeps the reference and version used to create it. Additional comparisons use the same saved assessment result.</p>{workspace.canCreate && <Button disabled={!workspace.templates.length} onClick={() => { setRequestId(crypto.randomUUID()); setReferenceId(workspace.campaignReferenceId); setError(null); setOpen(true) }}>Create report</Button>}</div>
    {workspace.canCreate && !workspace.templates.length && <Alert variant="info"><AlertDescription>Add an active reference-compatible report template to this campaign or its assessment to create additional reports.</AlertDescription></Alert>}
    <DataTable columns={columns} data={workspace.history} searchableColumns={['templateName','referenceName']} searchPlaceholder="Search report editions…" />
    <ActionDialog open={open} onOpenChange={setOpen} title="Create another report" description="Choose a reference for this completed assessment. Your existing reports and saved answers are kept.">
      <ActionDialogBody>
        <label htmlFor="reference-report-template" className="text-sm font-medium">Report template</label>
        <select id="reference-report-template" className="h-10 w-full rounded-md border border-input bg-background px-3" value={templateId} onChange={e => setTemplateId(e.target.value)}>{workspace.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <ReferenceChooser references={workspace.references} value={referenceId} onChange={setReferenceId} pinnedId={workspace.campaignReferenceId} disabled={pending} allowScaleOnly={!workspace.templates.find(t => t.id === templateId)?.requiresReference} />
        {workspace.templates.find(t => t.id === templateId)?.requiresReference && !referenceId && <p role="alert" className="text-sm text-muted-foreground">Choose a norm reference to create the standard percentile report.</p>}
        <p className="text-sm text-muted-foreground">The new report is prepared for review. Releasing or sending it remains a separate action.</p>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      </ActionDialogBody>
      <ActionDialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={pending || !templateId || (!referenceId && Boolean(workspace.templates.find(t => t.id === templateId)?.requiresReference))} onClick={() => start(async () => {
        try { await createReferenceReportEdition({ sessionId, templateId, referenceId, requestId, parentSnapshotId: workspace.history.find(r => r.participantSelected)?.id ?? null }); toast.success('Additional report queued'); setOpen(false); router.refresh() }
        catch (e) { const message = e instanceof Error ? e.message : 'Unable to create report'; setError(message); toast.error(message) }
      })}>{pending ? 'Creating…' : 'Create report'}</Button></ActionDialogFooter>
    </ActionDialog>
  </div>
}
