'use client'

import { cn } from '@/lib/utils'

interface BandBadgeProps {
  band: 'high' | 'mid' | 'low'
  label: string
  className?: string
}

export function BandBadge({ band, label, className }: BandBadgeProps) {
  const bgVar = `var(--report-${band}-badge-bg)`
  const textVar = `var(--report-${band}-badge-text)`

  return (
    <span
      className={cn(
        'inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md',
        className
      )}
      style={{ background: bgVar, color: textVar }}
    >
      {label}
    </span>
  )
}
