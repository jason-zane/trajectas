'use client'

import { cn } from '@/lib/utils'

interface SegmentBarProps {
  value: number
  band: 'high' | 'mid' | 'low'
  className?: string
}

export function SegmentBar({ value, band, className }: SegmentBarProps) {
  return (
    <div
      className={cn('h-2 rounded-full w-full', className)}
      style={{ background: 'var(--report-divider)' }}
    >
      <div
        className="h-2 rounded-full"
        style={{
          width: `${value}%`,
          background: `var(--report-${band}-band-fill)`,
        }}
      />
    </div>
  )
}
