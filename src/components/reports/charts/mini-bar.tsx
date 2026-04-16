'use client'

import { cn } from '@/lib/utils'
import { getBandColour, type PaletteKey } from '@/lib/reports/band-scheme'

interface MiniBarProps {
  value: number
  bandIndex: number
  bandCount: number
  palette: PaletteKey
  className?: string
}

export function MiniBar({ value, bandIndex, bandCount, palette, className }: MiniBarProps) {
  const fill = getBandColour(palette, bandIndex, bandCount)
  return (
    <div
      className={cn('h-[5px] rounded w-full', className)}
      style={{ background: 'var(--report-divider)' }}
    >
      <div
        className="h-[5px] rounded"
        style={{ width: `${value}%`, background: fill }}
      />
    </div>
  )
}
