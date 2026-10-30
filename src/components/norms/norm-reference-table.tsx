'use client'
import { ReferenceDetails } from './reference-details'
import { ReferenceRefreshDialog } from './reference-refresh-dialog'
import { ReferenceFilters } from './reference-filters'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { MoreHorizontal } from 'lucide-react'
import { DataTable, DataTableRowActions } from '@/components/data-table'
import { ActionDialog, ActionDialogBody, ActionDialogFooter } from '@/components/action-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EmptyState } from '@/components/empty-state'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { updateReferenceReview } from '@/app/actions/norm-references'
import { referenceWeightingLabel, type ReferenceOption, type ReferenceStatus } from '@/lib/norms/types'
import { EMPTY_REFERENCE_FILTERS, REFERENCE_STATUS_LABELS, groupNormReferences, matchesReferenceFilters, referenceAgeLabel, referenceAssessmentLabel, referenceGeography, referenceMatchesView, type ReferenceGroup, type ReferenceView } from '@/lib/norms/catalog'

const checksText = { datasetReuse: 'Dataset reuse and attribution', formEquivalence: 'Administered form equivalence', methodology: 'Scoring and percentile methodology', stability: 'Distribution stability and uncertainty', intendedUse: 'Intended population and use' }
const allowedStatuses: Record<ReferenceStatus, ReferenceStatus[]> = { draft: ['review','active','withdrawn'], review: ['review','active','withdrawn'], active: ['active','superseded','withdrawn'], superseded: ['superseded','withdrawn'], withdrawn: ['withdrawn'] }
const initialChecks = { datasetReuse: false, formEquivalence: false, methodology: false, stability: false, intendedUse: false }
const views: { value: ReferenceView; label: string; description: string }[] = [
  { value: 'available', label: 'Available', description: 'One row per group. Open Versions to see its drafts and earlier releases.' },
  { value: 'review', label: 'Needs review', description: 'Drafts and versions awaiting review. An available group can also have a draft.' },
  { value: 'history', label: 'History', description: 'Superseded and withdrawn versions. Existing campaigns and reports keep their original reference.' },
]
type CatalogRow = ReferenceOption & { group: ReferenceGroup }
export function NormReferenceTable({ references }: { references: ReferenceOption[] }) {
  const [view, setView] = useState<ReferenceView>('available')
  const [filters, setFilters] = useState({ ...EMPTY_REFERENCE_FILTERS })
  const [inspecting, setInspecting] = useState<ReferenceGroup | null>(null)
  const [editing, setEditing] = useState<ReferenceOption[]>([])
  const [refreshing, setRefreshing] = useState<ReferenceOption | null>(null)
  const [status, setStatus] = useState<ReferenceStatus>('review')
  const [evidence, setEvidence] = useState('')
  const [checks, setChecks] = useState(initialChecks)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const groups = useMemo(() => groupNormReferences(references), [references])
  const rows: CatalogRow[] = groups.flatMap(group => {
    const reference = group.versions.find(r => referenceMatchesView(r, view) && matchesReferenceFilters(r, filters))
    return reference ? [{ ...reference, group }] : []
  })
  const total = groups.filter(group => group.versions.some(r => referenceMatchesView(r, view))).length
  const availableStatuses = (['review','active','superseded','withdrawn'] as ReferenceStatus[]).filter(status => editing.every(row => allowedStatuses[row.status].includes(status)))
  function edit(rows: ReferenceOption[]) { setEditing(rows); setEvidence(''); setChecks(Object.fromEntries(Object.keys(initialChecks).map(key => [key, rows.every(row => row.reviewEvidence[key] === 'approved')])) as typeof initialChecks); setStatus(rows.length === 1 && rows[0].status !== 'draft' ? rows[0].status : rows.every(row => allowedStatuses[row.status].includes('review')) ? 'review' : 'withdrawn'); setError(null) }
  const columns: ColumnDef<CatalogRow>[] = [
    { accessorKey: 'name', header: 'Norm group', cell: ({ row }) => <div className="min-w-56 max-w-sm"><p className="font-semibold">{row.original.name}</p><p className="mt-1 text-caption text-muted-foreground">{row.original.assessments?.map(a => a.title).join(', ') || referenceAssessmentLabel(row.original)}</p></div> },
    { id: 'geography', header: 'Geography', cell: ({ row }) => <span className="inline-block min-w-28">{referenceGeography(row.original)}</span> },
    { id: 'age', header: 'Ages', cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{referenceAgeLabel(row.original)}</span> },
    { accessorKey: 'weighting', header: 'Weighting', cell: ({ row }) => <span className="inline-block min-w-36">{referenceWeightingLabel(row.original.weighting)}</span> },
    { accessorKey: 'rawN', header: 'Responses', cell: ({ row }) => <div className="whitespace-nowrap tabular-nums"><p>{row.original.rawN.toLocaleString('en-AU')}</p><p className="mt-1 text-caption text-muted-foreground">Effective N {Math.round(row.original.effectiveN).toLocaleString('en-AU')}</p></div> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant="outline">{REFERENCE_STATUS_LABELS[row.original.status]}</Badge> },
    { id: 'versions', header: 'Versions', cell: ({ row }) => <Button variant="ghost" size="sm" aria-label={`Versions for ${row.original.name}`} onClick={() => setInspecting(row.original.group)}>Versions ({row.original.group.versions.length})</Button> },
    { id: 'actions', cell: ({ row }) => <DataTableRowActions><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.name}`} />}><MoreHorizontal aria-hidden="true" className="size-4" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => edit([row.original])}>Review</DropdownMenuItem><DropdownMenuItem onClick={() => setRefreshing(row.original)}>New version</DropdownMenuItem></DropdownMenuContent></DropdownMenu></DataTableRowActions> },
  ]
  return <>
    {refreshing && <ReferenceRefreshDialog key={refreshing.id} reference={refreshing} onClose={() => setRefreshing(null)} />}
    <Tabs value={view} onValueChange={value => setView(value as ReferenceView)} className="gap-5">
      <TabsList aria-label="Norm group availability" variant="line" className="max-w-full gap-0">
        {views.map(tab => <TabsTrigger key={tab.value} value={tab.value} className="px-1.5 py-0 text-xs sm:px-3 sm:text-sm">{tab.label}<span className="text-caption tabular-nums text-muted-foreground">{groups.filter(group => group.versions.some(r => referenceMatchesView(r, tab.value))).length}</span></TabsTrigger>)}
      </TabsList>
      {views.map(tab => <TabsContent key={tab.value} value={tab.value} className="space-y-4">
        {view === tab.value && <>
          <p className="text-sm text-muted-foreground">{tab.description}</p>
          <ReferenceFilters references={references} filters={filters} onChange={setFilters} />
          <p role="status" className="text-caption text-muted-foreground tabular-nums">{rows.length} of {total} norm groups</p>
          {/* Changing the visible population clears pagination and bulk selection together. */}
          <DataTable key={JSON.stringify([view, filters])} columns={columns} data={rows} revealOnScroll={false} enableRowSelection getRowId={r => r.id} bulkActions={[{ label: 'Review', action: (_ids, selected) => edit(selected) }]} emptyState={<EmptyState title={total ? 'No matching norm groups' : `No groups ${view === 'review' ? 'awaiting review' : view === 'history' ? 'in history' : 'available'}`} description={total ? 'Change the search or reset the filters to see more groups.' : 'Groups will appear here when a reference version reaches this stage.'} className="border-0 py-12" />} />
        </>}
      </TabsContent>)}
    </Tabs>
    <ActionDialog open={Boolean(inspecting)} onOpenChange={open => { if (!open) setInspecting(null) }} title={inspecting?.versions[0].name ?? 'Norm group versions'} description="Each version keeps its own source evidence and review. Existing campaigns and reports retain their selected version.">
      <ActionDialogBody className="space-y-5">
        {inspecting?.versions.map(reference => <div key={reference.id} className="space-y-3 border-b border-border pb-5 last:border-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="outline">{REFERENCE_STATUS_LABELS[reference.status]}</Badge><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => { setInspecting(null); edit([reference]) }}>Review</Button><Button variant="ghost" size="sm" onClick={() => { setInspecting(null); setRefreshing(reference) }}>New version</Button></div></div>
          <p className="break-words text-sm font-semibold">{reference.version}</p>
          {reference.status === 'draft' && inspecting.versions.some(r => r.provenance?.previousVersionId === reference.id && r.status === 'active') && <p className="text-caption text-muted-foreground">Preparation draft for the active version</p>}
          <details className="text-sm"><summary className="cursor-pointer font-medium">Source and methodology</summary><div className="mt-3"><ReferenceDetails reference={reference} /></div></details>
        </div>)}
      </ActionDialogBody>
      <ActionDialogFooter><Button variant="outline" onClick={() => setInspecting(null)}>Done</Button></ActionDialogFooter>
    </ActionDialog>
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
