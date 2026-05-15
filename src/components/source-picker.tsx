'use client'

import Link from 'next/link'
import { Tag } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ContentSource } from '@/types/database'

const NONE_VALUE = '__none__'

/**
 * Reusable provenance picker. Renders a dropdown of admin-managed
 * content_sources plus a "None" option, and emits the picked source's id (or
 * empty string for None) to the form via a hidden field bearing `name`.
 */
export function SourcePicker({
  sources,
  value,
  onChange,
  name = 'sourceId',
  label = 'Source',
  helpText = "Provenance label — where this content came from. Optional.",
}: {
  sources: ContentSource[]
  value: string | undefined
  onChange: (next: string) => void
  name?: string
  label?: string
  helpText?: string
}) {
  const selected = value && value.length > 0 ? value : NONE_VALUE

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Tag className="size-4 text-primary" />
        </div>
        <div className="space-y-0.5">
          <Label htmlFor={`${name}-picker`}>{label}</Label>
          <p className="text-xs text-muted-foreground">
            {helpText}{' '}
            <Link href="/settings/content-sources" className="underline hover:no-underline">
              Manage sources
            </Link>
            .
          </p>
        </div>
      </div>
      <div className="w-56">
        <Select
          value={selected}
          onValueChange={(next) => onChange(next == null || next === NONE_VALUE ? '' : next)}
        >
          <SelectTrigger id={`${name}-picker`} className="w-full">
            <SelectValue>
              {(current: string | null) => {
                if (!current || current === NONE_VALUE) return 'None'
                return sources.find((s) => s.id === current)?.name ?? 'None'
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>None</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name={name} value={value ?? ''} />
      </div>
    </div>
  )
}
