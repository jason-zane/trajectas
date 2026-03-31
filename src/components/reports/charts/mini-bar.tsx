'use client'

import { cn } from '@/lib/utils'

interface MiniBarProps {
  value: number
  band: 'high' | 'mid' | 'low'
  className?: string
}

export function MiniBar({ value, band, className }: MiniBarProps) {
  return (
    <div
      className={cn('h-[5px] rounded w-full', className)}
      style={{ background: 'var(--report-divider)' }}
    >
      <div
        className="h-[5px] rounded"
        style={{
          width: `${value}%`,
          background: `var(--report-${band}-band-fill)`,
        }}
      />
    </div>
  )
}
