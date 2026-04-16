'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { getBandColour, type PaletteKey, type BandDefinition } from '@/lib/reports/band-scheme'
import type { BandValidationError } from '@/lib/reports/band-scheme-validation'

interface BandRowProps {
  band: BandDefinition
  index: number
  bandCount: number
  palette: PaletteKey
  errors: BandValidationError[]
  canRemove: boolean
  onUpdate: (patch: Partial<BandDefinition>) => void
  onRemove: () => void
}

export function BandRow({ band, index, bandCount, palette, errors, canRemove, onUpdate, onRemove }: BandRowProps) {
  const colour = getBandColour(palette, index, bandCount)
  const hasErr = (field: string) => errors.some((e) => e.bandIndex === index && e.field === field)

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border bg-background">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: colour }} aria-hidden />
      <div className="flex-1 min-w-0">
        <Label className="sr-only">Label</Label>
        <Input
          value={band.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Label"
          className="h-8 text-sm"
          aria-invalid={hasErr('label')}
        />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Input
          type="number"
          value={band.min}
          onChange={(e) => onUpdate({ min: Number(e.target.value) })}
          className="h-8 text-sm w-16"
          min={0}
          max={100}
          aria-invalid={hasErr('min')}
          aria-label="Minimum"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="number"
          value={band.max}
          onChange={(e) => onUpdate({ max: Number(e.target.value) })}
          className="h-8 text-sm w-16"
          min={0}
          max={100}
          aria-invalid={hasErr('max')}
          aria-label="Maximum"
        />
      </div>
      <Select
        value={band.indicatorTier}
        onValueChange={(v) => onUpdate({ indicatorTier: v as 'low' | 'mid' | 'high' })}
      >
        <SelectTrigger className="h-8 text-sm w-24" aria-label="Indicator tier">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="mid">Mid</SelectItem>
          <SelectItem value="high">High</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={!canRemove}
        className="h-8 w-8 shrink-0"
        aria-label="Remove band"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}
