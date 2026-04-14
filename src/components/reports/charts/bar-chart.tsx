'use client'

import { cn } from '@/lib/utils'
import { BandBadge } from './band-badge'

interface BarChartItem {
  name: string
  value: number
  band: 'high' | 'mid' | 'low'
  bandLabel?: string
}

interface BarChartProps {
  items: BarChartItem[]
  showBandLabels?: boolean
  showScore?: boolean
  variant?: 'light' | 'dark'
  className?: string
}

export function BarChart({
  items,
  showBandLabels = false,
  showScore = false,
  variant = 'light',
  className,
}: BarChartProps) {
  const isDark = variant === 'dark'
  const hasPerRowLabels = showBandLabels && items.some((i) => i.bandLabel)

  return (
    <div className={cn('w-full', className)}>
      {items.map((item) => (
        <div
          key={item.name}
          className="grid items-center mb-3"
          style={{ gridTemplateColumns: `140px 1fr${showScore ? ' 36px' : ''}${hasPerRowLabels ? ' auto' : ''}`, gap: '12px' }}
        >
          {/* Label */}
          <div
            className="text-[13px] font-medium text-right"
            style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'var(--report-heading-colour)' }}
          >
            {item.name}
          </div>

          {/* Track + fill */}
          <div
            className="relative h-2 rounded-full"
            style={{ background: isDark ? 'rgba(255,255,255,0.15)' : 'var(--report-divider)' }}
          >
            <div
              className="absolute top-0 left-0 h-2 rounded-full"
              style={{
                width: `${item.value}%`,
                background: `var(--report-${item.band}-band-fill)`,
              }}
            />
          </div>

          {/* Score value */}
          {showScore && (
            <div
              className="text-[13px] font-semibold tabular-nums text-right"
              style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'var(--report-heading-colour)' }}
            >
              {item.value}
            </div>
          )}

          {/* Per-row band label */}
          {hasPerRowLabels && item.bandLabel && (
            <BandBadge band={item.band} label={item.bandLabel} />
          )}
        </div>
      ))}
    </div>
  )
}
