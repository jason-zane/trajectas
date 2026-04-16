'use client'

import { cn } from '@/lib/utils'
import { getBandColour, type PaletteKey } from '@/lib/reports/band-scheme'

interface BandBadgeProps {
  label: string
  bandIndex: number
  bandCount: number
  palette: PaletteKey
  className?: string
}

export function BandBadge({ label, bandIndex, bandCount, palette, className }: BandBadgeProps) {
  const colour = getBandColour(palette, bandIndex, bandCount)

  return (
    <span
      className={cn(
        'inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md',
        className,
      )}
      style={{
        color: colour,
        // Subtle tinted background: the band colour at ~12% alpha
        background: `${colour}1f`,
      }}
    >
      {label}
    </span>
  )
}
