'use client'

import { useId } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EMPTY_REFERENCE_FILTERS, referenceFilterOptions, type ReferenceFilters as Filters } from '@/lib/norms/catalog'
import type { ReferenceOption } from '@/lib/norms/types'

export function ReferenceFilters({ references, filters, onChange, disabled = false, compact = false }: {
  references: ReferenceOption[]; filters: Filters; onChange: (filters: Filters) => void; disabled?: boolean; compact?: boolean
}) {
  const id = useId()
  const options = referenceFilterOptions(references)
  const fields = [
    { key: 'assessment', label: 'Assessment', all: 'All assessments' },
    { key: 'geography', label: 'Country / geography', all: 'All geographies' },
    { key: 'age', label: 'Age range', all: 'All age ranges' },
    { key: 'weighting', label: 'Weighting', all: 'All methods' },
  ] as { key: Exclude<keyof Filters, 'search'>; label: string; all: string }[]
  const hasFilters = Object.values(filters).some(value => value.trim())
  return <div className="space-y-3">
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Search norm groups" placeholder="Search country, age or weighting…" className="pl-9" value={filters.search} disabled={disabled} onChange={e => onChange({ ...filters, search: e.target.value })} />
      </div>
      {hasFilters && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange({ ...EMPTY_REFERENCE_FILTERS })}><X aria-hidden="true" className="size-4" />Reset</Button>}
    </div>
    <div className={`grid grid-cols-2 gap-3 ${compact ? '' : 'xl:grid-cols-4'}`}>
      {fields.map(field => <div key={field.key} className="min-w-0 space-y-1.5">
        <label className="text-caption font-medium text-muted-foreground" htmlFor={`${id}-${field.key}`}>{field.label}</label>
        <Select value={filters[field.key] || 'all'} disabled={disabled} onValueChange={value => onChange({ ...filters, [field.key]: value === 'all' || !value ? '' : value })}>
          <SelectTrigger id={`${id}-${field.key}`} className="min-h-10 w-full min-w-0"><SelectValue>{options[field.key].find(o => o.value === filters[field.key])?.label ?? field.all}</SelectValue></SelectTrigger>
          <SelectContent align="start" className="max-h-72"><SelectItem value="all">{field.all}</SelectItem>{options[field.key].map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>)}
    </div>
  </div>
}
