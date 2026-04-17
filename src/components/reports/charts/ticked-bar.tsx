'use client'

import { cn } from '@/lib/utils'
import { getBandColour, type PaletteKey, type BandDefinition } from '@/lib/reports/band-scheme'

/** Compute tick positions (percentages) from band boundaries. */
export function computeTickPositions(bands: BandDefinition[]): number[] {
  if (bands.length <= 1) return []
  return bands.slice(0, -1).map((b) => b.max)
}

interface TickedBarProps {
  value: number
  bandIndex: number
  bandCount: number
  palette: PaletteKey
  bands: BandDefinition[]
  /** Tick colour — defaults to rgba(0,0,0,0.22) */
  tickColour?: string
  className?: string
}

export function TickedBar({
  value,
  bandIndex,
  bandCount,
  palette,
  bands,
  tickColour = 'rgba(0,0,0,0.22)',
  className,
}: TickedBarProps) {
  const fill = getBandColour(palette, bandIndex, bandCount)
  const ticks = computeTickPositions(bands)

  return (
    <div
      className={cn('rounded-full w-full relative overflow-hidden', className)}
      style={{ background: 'var(--report-divider)' }}
    >
      <div
        className="absolute top-0 left-0 bottom-0 rounded-full"
        style={{ width: `${value}%`, background: fill }}
      />
      {ticks.map((t) => (
        <span
          key={t}
          className="absolute top-0 bottom-0 w-[1.5px]"
          style={{
            left: `${t}%`,
            background: tickColour,
            transform: 'translateX(-50%)',
          }}
        />
      ))}
    </div>
  )
}
