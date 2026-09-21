'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updateCapabilityAvailability } from '@/app/actions/model-management'
import { availabilityIssue, modelChannels, type ManagedCapability, type ModelChannel } from '@/lib/library/model-management'

export function ModelManagement({ capabilities }: { capabilities: ManagedCapability[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [bulkChannel, setBulkChannel] = useState<ModelChannel>('matching')
  async function save(ids: string[], channel: ModelChannel, enabled: boolean) {
    setError(null)
    try {
      const result = await updateCapabilityAvailability({ ids, channel, enabled })
      if (result.error) throw new Error(result.error)
      toast.success(`${modelChannels[channel].label} ${enabled ? 'enabled' : 'disabled'}`)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save availability.'
      setError(message)
      toast.error(message)
    }
  }
  const channels = Object.keys(modelChannels) as ModelChannel[]
  const columns: ColumnDef<ManagedCapability>[] = [
    { accessorKey: 'name', header: 'Capability', cell: ({ row: { original: c } }) => <div className="min-w-48 py-2"><Link className="font-semibold hover:underline" href={`/factors/${c.slug}/edit`}>{c.name}</Link><p className="mt-1 max-w-sm text-xs text-muted-foreground line-clamp-2">{c.definition || 'Definition needed'}</p>{!c.active && <Badge variant="secondary">Inactive</Badge>}</div> },
    { accessorKey: 'category', header: 'Group' },
    { accessorKey: 'readiness', header: 'Readiness', cell: ({ row }) => <Badge variant="outline">{row.original.readiness.replaceAll('_', ' ')}</Badge> },
    ...channels.map((channel): ColumnDef<ManagedCapability> => ({ accessorKey: channel, header: modelChannels[channel].label, cell: ({ row: { original: c } }) => {
      const issue = availabilityIssue(c, channel)
      return <div className="min-w-28"><Switch aria-label={`${modelChannels[channel].label}: ${c.name}`} checked={c[channel]} disabled={pending || (!c[channel] && !!issue)} onCheckedChange={enabled => startTransition(() => save([c.id], channel, enabled))} /><p className="mt-1 max-w-40 text-xs text-muted-foreground">{issue ?? (c[channel] ? 'On' : 'Off')}</p></div>
    } })),
  ]
  return <div className="space-y-7">
    <PageHeader eyebrow="Library / Governance" title="Core capability model" description="Decide where each capability is available. Changes take effect immediately." />
    <div className="grid gap-4 md:grid-cols-3">{channels.map(channel => <div key={channel} className="rounded-xl border bg-card p-5"><p className="text-sm font-semibold">{modelChannels[channel].label}</p><p className="my-2 text-3xl font-semibold tabular-nums">{capabilities.filter(c => c[channel]).length}<span className="ml-2 text-sm font-normal text-muted-foreground">enabled</span></p><p className="text-sm text-muted-foreground">{modelChannels[channel].description}</p></div>)}</div>
    <Alert><AlertDescription>Availability and readiness are separate. Drafts cannot be newly enabled for matching or assessment building. Public capabilities need a group and definition. Inactive capabilities remain unavailable. Readiness is an editorial workflow status, not a claim of psychometric validation.</AlertDescription></Alert>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="text-sm">Bulk changes apply to <select className="ml-2 rounded-md border bg-background p-2" value={bulkChannel} onChange={event => setBulkChannel(event.target.value as ModelChannel)}>{channels.map(channel => <option key={channel} value={channel}>{modelChannels[channel].label}</option>)}</select></label><Link className="text-sm text-primary underline underline-offset-4" href="/capability-model" target="_blank">View public library</Link></div>
    <DataTable columns={columns} data={capabilities} searchableColumns={['name', 'definition', 'category']} searchPlaceholder="Find a capability…" enableRowSelection getRowId={row => row.id} revealOnScroll={false} filterableColumns={[
      { id: 'category', title: 'Group', options: [...new Set(capabilities.map(c => c.category))].sort().map(value => ({ label: value, value })) },
      { id: 'readiness', title: 'Readiness', options: ['draft', 'assessment_ready', 'match_ready'].map(value => ({ label: value.replaceAll('_', ' '), value })) },
      ...channels.map(channel => ({ id: channel, title: modelChannels[channel].label, options: [{ label: 'On', value: 'true' }, { label: 'Off', value: 'false' }] })),
    ]} bulkActions={[{ label: 'Enable selected', action: ids => save(ids, bulkChannel, true) }, { label: 'Disable selected', action: ids => save(ids, bulkChannel, false) }]} />
    <p className="text-sm text-muted-foreground">Open a capability to edit its definition, grouping and readiness. Channel changes do not remove capabilities from existing assessments or saved role profiles.</p>
  </div>
}
