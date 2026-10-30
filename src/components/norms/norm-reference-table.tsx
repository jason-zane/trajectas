'use client'
import { ReferenceDetails } from './reference-details'
import { ReferenceRefreshDialog } from './reference-refresh-dialog'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { DataTable, DataTableRowActions } from '@/components/data-table'
import { ActionDialog, ActionDialogBody, ActionDialogFooter } from '@/components/action-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updateReferenceReview } from '@/app/actions/norm-references'
import { REFERENCE_FAMILIES, referenceWeightingLabel, type ReferenceOption, type ReferenceStatus } from '@/lib/norms/types'

const checksText = { datasetReuse: 'Dataset reuse and attribution', formEquivalence: 'Administered form equivalence', methodology: 'Scoring and percentile methodology', stability: 'Distribution stability and uncertainty', intendedUse: 'Intended population and use' }
const allowedStatuses: Record<ReferenceStatus, ReferenceStatus[]> = { draft: ['review','active','withdrawn'], review: ['review','active','withdrawn'], active: ['active','superseded','withdrawn'], superseded: ['superseded','withdrawn'], withdrawn: ['withdrawn'] }
const initialChecks = { datasetReuse: false, formEquivalence: false, methodology: false, stability: false, intendedUse: false }
export function NormReferenceTable({ references }: { references: ReferenceOption[] }) {
  const [editing, setEditing] = useState<ReferenceOption[]>([])
  const [refreshing, setRefreshing] = useState<ReferenceOption | null>(null)
  const [status, setStatus] = useState<ReferenceStatus>('review')
  const [evidence, setEvidence] = useState('')
  const [checks, setChecks] = useState(initialChecks)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const availableStatuses = (['review','active','superseded','withdrawn'] as ReferenceStatus[]).filter(status => editing.every(row => allowedStatuses[row.status].includes(status)))
  function edit(rows: ReferenceOption[]) { setEditing(rows); setEvidence(''); setChecks(Object.fromEntries(Object.keys(initialChecks).map(key => [key, rows.every(row => row.reviewEvidence[key] === 'approved')])) as typeof initialChecks); setStatus(rows.length === 1 && rows[0].status !== 'draft' ? rows[0].status : rows.every(row => allowedStatuses[row.status].includes('review')) ? 'review' : 'withdrawn'); setError(null) }
  const columns: ColumnDef<ReferenceOption>[] = [
    { accessorKey: 'name', header: 'Norm group', cell: ({ row }) => <div className="min-w-56 max-w-sm"><p className="font-medium">{row.original.name}</p><p className="text-caption text-muted-foreground">{row.original.instrumentId === 'ipip-neo-120-johnson-2014' ? 'Trajectas Personality Profile' : row.original.instrumentId}</p></div> },
    { accessorKey: 'family', header: 'Family', cell: ({ row }) => REFERENCE_FAMILIES[row.original.family] ?? row.original.family },
    { accessorKey: 'weighting', header: 'Weighting', cell: ({ row }) => <span className="inline-block min-w-36">{referenceWeightingLabel(row.original.weighting)}</span> },
    { accessorKey: 'rawN', header: 'Responses', cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{row.original.rawN.toLocaleString('en-AU')}</span> },
    { accessorKey: 'effectiveN', header: 'Effective N', cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{Math.round(row.original.effectiveN).toLocaleString('en-AU')}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge> },
    { accessorKey: 'version', header: 'Version', cell: ({ row }) => <span className="whitespace-nowrap text-caption" title={row.original.version}>{row.original.version.replace(/^ipip-neo-120-reference-draft-/, '')}</span> },
    { id: 'actions', cell: ({ row }) => <DataTableRowActions><Button variant="ghost" size="sm" onClick={() => edit([row.original])}>Review</Button><Button variant="ghost" size="sm" onClick={() => setRefreshing(row.original)}>New version</Button></DataTableRowActions> },
  ]
  return <>
    {refreshing && <ReferenceRefreshDialog key={refreshing.id} reference={refreshing} onClose={() => setRefreshing(null)} />}
    <DataTable columns={columns} data={references} searchableColumns={['name', 'instrumentId', 'family', 'version']} searchPlaceholder="Search references or assessments…" enableRowSelection getRowId={r => r.id} bulkActions={[{ label: 'Review', action: (_ids, rows) => edit(rows) }]} filterableColumns={[
      { id: 'family', title: 'Family', options: Object.entries(REFERENCE_FAMILIES).map(([value, label]) => ({ value, label })) },
      { id: 'status', title: 'Status', options: ['draft','review','active','superseded','withdrawn'].map(value => ({ value, label: value })) },
    ]} />
    <ActionDialog open={editing.length > 0} onOpenChange={open => { if (!open) setEditing([]) }} title="Reference review" description={`${editing.length} selected version${editing.length === 1 ? '' : 's'}. Evidence and review decisions are recorded for each version.`}>
      <ActionDialogBody>
        <div className="max-h-60 space-y-3 overflow-y-auto">{editing.map(row => <details key={row.id} className="rounded-lg border border-border p-3"><summary className="cursor-pointer font-medium">{row.name} · {row.version}</summary><div className="mt-3"><ReferenceDetails reference={row} /></div></details>)}</div>
        <Alert variant="info"><AlertDescription>Sample size alone does not establish validity. Activate a version only after the source, method, population fit and release decision have been reviewed.</AlertDescription></Alert>
        <label className="block text-sm font-medium" htmlFor="reference-review-status">Review status</label>
        <Select disabled={pending} value={status} onValueChange={value => { if (value) setStatus(value as ReferenceStatus) }}>
          <SelectTrigger id="reference-review-status" className="w-full"><SelectValue>{({ review: 'In review', active: 'Approved / active', superseded: 'Superseded', withdrawn: 'Withdrawn', draft: 'Draft' })[status]}</SelectValue></SelectTrigger>
          <SelectContent>{availableStatuses.map(value => <SelectItem key={value} value={value}>{({ review: 'In review', active: 'Approved / active', superseded: 'Superseded', withdrawn: 'Withdrawn', draft: 'Draft' })[value]}</SelectItem>)}</SelectContent>
        </Select>
        <fieldset disabled={pending || editing.every(row => ['active','superseded','withdrawn'].includes(row.status))} className="space-y-3"><legend className="mb-3 text-sm font-medium">Completed reviews</legend>
          {Object.entries(checksText).map(([key, label]) => <label key={key} className="flex items-start gap-3 text-sm"><Checkbox className="mt-0.5" checked={checks[key as keyof typeof checks]} onCheckedChange={checked => setChecks(v => ({ ...v, [key]: Boolean(checked) }))} />{label}</label>)}
        </fieldset>
        {editing.length === 1 && editing[0].reviewEvidence.evidence && <details className="text-sm"><summary className="cursor-pointer font-medium">Recorded approval evidence</summary><p className="mt-2 whitespace-pre-wrap text-muted-foreground">{editing[0].reviewEvidence.evidence}</p></details>}
        <label className="block text-sm font-medium" htmlFor="reference-review-evidence">Evidence and decision</label>
        <Textarea disabled={pending} id="reference-review-evidence" value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="Record the reviewed sources, validation evidence and decision." rows={4} />
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      </ActionDialogBody>
      <ActionDialogFooter><Button variant="ghost" onClick={() => setEditing([])}>Cancel</Button><Button disabled={pending || evidence.trim().length < 20 || (status === 'active' && !Object.values(checks).every(Boolean))} onClick={() => start(async () => {
        try { for (const row of editing) await updateReferenceReview({ id: row.id, status, evidence, checks }); toast.success('Reference review recorded'); setEditing([]); router.refresh() }
        catch (e) { const message = e instanceof Error ? e.message : 'Unable to record review'; setError(message); toast.error(message); router.refresh() }
      })}>{pending ? 'Saving…' : 'Record decision'}</Button></ActionDialogFooter>
    </ActionDialog>
  </>
}
