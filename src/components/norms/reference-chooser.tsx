'use client'

import { useId, useMemo, useState } from 'react'
import { ReferenceDetails } from './reference-details'
import { ReferenceFilters } from './reference-filters'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/empty-state'
import { referenceWeightingLabel, type ReferenceOption } from '@/lib/norms/types'
import { EMPTY_REFERENCE_FILTERS, groupNormReferences, matchesReferenceFilters, referenceAgeLabel, referenceGeography } from '@/lib/norms/catalog'

function ReferenceChoice({ reference: r, name, value, onChange, disabled, pinnedId }: {
  reference: ReferenceOption; name: string; value: string | null; onChange: (value: string | null) => void; disabled: boolean; pinnedId: string | null
}) {
  const unavailable = r.status !== 'active' && !(r.status === 'superseded' && r.id === pinnedId)
  return <label className={`flex items-start gap-3 p-4 ${value === r.id ? 'bg-primary/5' : ''} ${disabled || unavailable ? 'cursor-default' : 'cursor-pointer hover:bg-muted/40'}`}>
    <input type="radio" name={name} value={r.id} checked={value === r.id} disabled={disabled || unavailable} onChange={() => onChange(r.id)} className="mt-1 size-4 shrink-0 accent-primary" />
    <span className="min-w-0 space-y-1">
      <span className="block text-sm font-semibold">{r.name}</span>
      <span className="block text-caption text-muted-foreground">{referenceGeography(r)} · ages {referenceAgeLabel(r)} · {referenceWeightingLabel(r.weighting)}</span>
      <span className="block text-caption text-muted-foreground tabular-nums">{r.rawN.toLocaleString('en-AU')} responses · effective N {Math.round(r.effectiveN).toLocaleString('en-AU')}</span>
      <span className="block break-words text-caption text-muted-foreground">{r.version}</span>
      {r.isDefault && <Badge variant="secondary">Assessment default</Badge>}
      {r.status === 'superseded' && <Badge variant="outline">{r.id === pinnedId ? 'Pinned earlier version' : 'Earlier version'}</Badge>}
    </span>
  </label>
}

export function ReferenceChooser({ references, value, onChange, disabled = false, pinnedId = null, allowScaleOnly = true }: {
  references: ReferenceOption[]; value: string | null; onChange: (value: string | null) => void; disabled?: boolean; pinnedId?: string | null; allowScaleOnly?: boolean
}) {
  const name = useId()
  const [filters, setFilters] = useState({ ...EMPTY_REFERENCE_FILTERS })
  const selected = references.find(r => r.id === value)
  const eligible = useMemo(() => references.filter(r => r.status === 'active' || r.id === value || r.id === pinnedId), [references, value, pinnedId])
  const groups = useMemo(() => groupNormReferences(eligible), [eligible])
  const visible = groups.flatMap(group => {
    const versions = group.versions.filter(r => matchesReferenceFilters(r, filters))
    return versions.length ? [{ ...group, versions }] : []
  })
  const visibleIds = new Set(visible.flatMap(group => group.versions.map(r => r.id)))
  const keptVisible = eligible.filter(r => (r.id === value || r.id === pinnedId) && !visibleIds.has(r.id))
  const choiceProps = { name, value, onChange, disabled, pinnedId }
  return <div className="space-y-3">
    <p className="text-sm font-medium">Reporting reference</p>
    <ReferenceFilters references={eligible} filters={filters} onChange={setFilters} disabled={disabled} compact />
    <p role="status" className="text-caption text-muted-foreground tabular-nums">{visible.length} of {groups.length} norm groups</p>
    <fieldset className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
      <legend className="sr-only">Choose one reporting reference</legend>
      {allowScaleOnly && <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/40">
        <input type="radio" name={name} value="none" checked={value === null} disabled={disabled} onChange={() => onChange(null)} className="mt-1 accent-primary" />
        <span><span className="block text-sm font-medium">Scale scores only</span><span className="text-caption text-muted-foreground">No norm comparison</span></span>
      </label>}
      {keptVisible.length > 0 && <div><p className="px-4 pt-3 text-caption font-medium text-muted-foreground">Selected or pinned reference · outside these filters</p>{keptVisible.map(r => <ReferenceChoice key={r.id} reference={r} {...choiceProps} />)}</div>}
      {visible.map(group => {
        const primary = group.versions.find(r => r.id === value) ?? group.versions[0]
        const others = group.versions.filter(r => r.id !== primary.id)
        return <div key={group.key}>
          <ReferenceChoice reference={primary} {...choiceProps} />
          {others.length > 0 && <details className="px-4 pb-3 text-sm"><summary className="cursor-pointer font-medium">Other versions ({others.length})</summary>{others.map(r => <ReferenceChoice key={r.id} reference={r} {...choiceProps} />)}</details>}
        </div>
      })}
      {!visible.length && <EmptyState size="sm" title="No matching norm groups" description="Change the search or reset the filters to see more groups." className="border-0" />}
    </fieldset>
    {!references.some(r => r.status === 'active') && <p className="text-sm text-muted-foreground">No approved references are available for this assessment. Draft references remain in review.</p>}
    {value && !selected && <p role="alert" className="text-sm text-destructive">The selected reference is no longer available. Choose a compatible reference before generating a new report.</p>}
    {selected && <details className="text-sm">
      <summary className="cursor-pointer font-medium">Reference details</summary>
      <div className="mt-3"><ReferenceDetails reference={selected} /></div>
    </details>}
  </div>
}
