'use client'

import { cn } from '@/lib/utils'
import { getBandChipColours, type PaletteKey } from '@/lib/reports/band-scheme'

interface BandBadgeProps {
  label: string
  bandIndex: number
  bandCount: number
  palette: PaletteKey
  className?: string
}

export function BandBadge({ label, bandIndex, bandCount, palette, className }: BandBadgeProps) {
  const chip = getBandChipColours(palette, bandIndex, bandCount)

  return (
    <span
      className={cn(
        'inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        className,
      )}
      style={{
        color: chip.text,
        background: chip.bg,
      }}
    >
      {label}
    </span>
  )
}
