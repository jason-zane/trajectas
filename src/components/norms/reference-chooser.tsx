'use client'

import { useId, useState } from 'react'
import { ReferenceDetails } from './reference-details'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { REFERENCE_FAMILIES, referenceWeightingLabel, type ReferenceOption } from '@/lib/norms/types'

export function ReferenceChooser({ references, value, onChange, disabled = false, pinnedId = null, allowScaleOnly = true }: {
  references: ReferenceOption[]; value: string | null; onChange: (value: string | null) => void; disabled?: boolean; pinnedId?: string | null; allowScaleOnly?: boolean
}) {
  const name = useId()
  const [search, setSearch] = useState('')
  const selected = references.find(r => r.id === value)
  const visible = references.filter(r => r.status === 'active' || r.id === value || r.id === pinnedId).filter(r => `${r.name} ${REFERENCE_FAMILIES[r.family]} ${r.countryLabels?.join(' ') ?? ''} ${referenceWeightingLabel(r.weighting)}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="space-y-3">
    <label className="block text-sm font-medium" htmlFor={`${name}-search`}>Reporting reference</label>
    <Input id={`${name}-search`} placeholder="Search by country, age or reference family" value={search} onChange={e => setSearch(e.target.value)} disabled={disabled} />
    <fieldset className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
      <legend className="sr-only">Choose one reporting reference</legend>
      {allowScaleOnly && <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/40">
        <input type="radio" name={name} value="none" checked={value === null} disabled={disabled} onChange={() => onChange(null)} className="mt-1 accent-primary" />
        <span><span className="block text-sm font-medium">Scale scores only</span><span className="text-caption text-muted-foreground">No norm comparison</span></span>
      </label>}
      {visible.map(r => <label key={r.id} className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/40">
        <input type="radio" name={name} value={r.id} checked={value === r.id} disabled={disabled || (r.status !== 'active' && r.id !== pinnedId)} onChange={() => onChange(r.id)} className="mt-1 accent-primary" />
        <span className="min-w-0 space-y-1">
          <span className="block text-sm font-medium">{r.name}</span>
          <span className="block text-caption text-muted-foreground">{REFERENCE_FAMILIES[r.family] ?? r.family} · {referenceWeightingLabel(r.weighting)}</span>
          <span className="block text-caption text-muted-foreground tabular-nums">{r.rawN.toLocaleString('en-AU')} responses · effective N {Math.round(r.effectiveN).toLocaleString('en-AU')}</span>
          {r.status === 'superseded' && <Badge variant="outline">Pinned earlier version</Badge>}
        </span>
      </label>)}
    </fieldset>
    {!references.some(r => r.status === 'active') && <p className="text-sm text-muted-foreground">No approved references are available for this assessment. Draft references remain in review.</p>}
    {value && !selected && <p role="alert" className="text-sm text-destructive">The selected reference is no longer available. Choose a compatible reference before generating a new report.</p>}
    {selected && <details className="text-sm">
      <summary className="cursor-pointer font-medium">Reference details</summary>
      <div className="mt-3"><ReferenceDetails reference={selected} /></div>
    </details>}
  </div>
}
