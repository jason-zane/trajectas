'use client'

import { cn } from '@/lib/utils'
import { getBandColour, type PaletteKey } from '@/lib/reports/band-scheme'

interface SegmentBarProps {
  value: number
  bandIndex: number
  bandCount: number
  palette: PaletteKey
  className?: string
}

export function SegmentBar({ value, bandIndex, bandCount, palette, className }: SegmentBarProps) {
  const fill = getBandColour(palette, bandIndex, bandCount)
  return (
    <div
      className={cn('h-2 rounded-full w-full', className)}
      style={{ background: 'var(--report-divider)' }}
    >
      <div
        className="h-2 rounded-full"
        style={{ width: `${value}%`, background: fill }}
      />
    </div>
  )
}
