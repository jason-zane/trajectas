'use client'

import { cn } from '@/lib/utils'
import { BandBadge } from './band-badge'

interface GaugeChartProps {
  items: { name: string; value: number; band: 'high' | 'mid' | 'low'; bandLabel: string }[]
  className?: string
}

// Approximate arc length for semicircle of radius 40
const ARC_LENGTH = 125.66 // π * 40

export function GaugeChart({ items, className }: GaugeChartProps) {
  return (
    <div className={cn('flex flex-wrap gap-2 justify-center', className)}>
      {items.map((item) => {
        const fillLength = (item.value / 100) * ARC_LENGTH
        const dashArray = `${fillLength} ${ARC_LENGTH}`

        return (
          <div key={item.name} className="flex flex-col items-center">
            <svg width={100} height={60} viewBox="0 0 100 60">
              {/* Background arc */}
              <path
                d="M10,55 A40,40 0 0,1 90,55"
                fill="none"
                stroke="var(--report-divider)"
                strokeWidth={6}
                strokeLinecap="round"
              />
              {/* Value arc */}
              <path
                d="M10,55 A40,40 0 0,1 90,55"
                fill="none"
                stroke={`var(--report-${item.band}-band-fill)`}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={dashArray}
                strokeDashoffset={0}
              />
            </svg>
            <span className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--report-heading-colour)' }}>
              {item.name}
            </span>
            <BandBadge band={item.band} label={item.bandLabel} className="mt-1" />
          </div>
        )
      })}
    </div>
  )
}
