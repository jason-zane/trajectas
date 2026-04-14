'use client'

import { cn } from '@/lib/utils'
import { BandBadge } from './band-badge'

interface GaugeChartProps {
  items: { name: string; value: number; band: 'high' | 'mid' | 'low'; bandLabel: string }[]
  showScore?: boolean
  showBandLabel?: boolean
  variant?: 'light' | 'dark'
  className?: string
}

// Approximate arc length for semicircle of radius 40
const ARC_LENGTH = 125.66 // π * 40

export function GaugeChart({ items, showScore = true, showBandLabel = true, variant = 'light', className }: GaugeChartProps) {
  const isDark = variant === 'dark'
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
              {/* Score text inside arc */}
              {showScore && (
                <text
                  x={50}
                  y={48}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={600}
                  fill={isDark ? 'rgba(255,255,255,0.85)' : 'var(--report-heading-colour)'}
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}
                >
                  {item.value}
                </text>
              )}
            </svg>
            <span className="text-[11px] font-semibold mt-0.5" style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'var(--report-heading-colour)' }}>
              {item.name}
            </span>
            {showBandLabel && (
              <BandBadge band={item.band} label={item.bandLabel} className="mt-1" />
            )}
          </div>
        )
      })}
    </div>
  )
}
