'use client'

import { cn } from '@/lib/utils'
import { BandBadge } from './band-badge'
import { getBandColour, type PaletteKey } from '@/lib/reports/band-scheme'

interface BarChartItem {
  name: string
  value: number
  bandIndex: number
  bandCount: number
  bandLabel?: string
}

interface BarChartProps {
  items: BarChartItem[]
  palette: PaletteKey
  showBandLabels?: boolean
  showScore?: boolean
  variant?: 'light' | 'dark'
  className?: string
}

export function BarChart({
  items,
  palette,
  showBandLabels = false,
  showScore = false,
  variant = 'light',
  className,
}: BarChartProps) {
  const isDark = variant === 'dark'

  return (
    <div className={cn('w-full', className)}>
      {items.map((item) => {
        const fill = getBandColour(palette, item.bandIndex, item.bandCount)
        return (
          <div
            key={item.name}
            className="grid items-center mb-3"
            style={{ gridTemplateColumns: `140px 1fr${showScore ? ' 36px' : ''}`, gap: '12px' }}
          >
            {/* Label + optional band badge below */}
            <div className="text-right">
              <div
                className="text-[13px] font-medium"
                style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'var(--report-heading-colour)' }}
              >
                {item.name}
              </div>
              {showBandLabels && item.bandLabel && (
                <div className="mt-0.5 flex justify-end">
                  <BandBadge
                    label={item.bandLabel}
                    bandIndex={item.bandIndex}
                    bandCount={item.bandCount}
                    palette={palette}
                  />
                </div>
              )}
            </div>

            {/* Track + fill */}
            <div
              className="relative h-2 rounded-full"
              style={{ background: isDark ? 'rgba(255,255,255,0.15)' : 'var(--report-divider)' }}
            >
              <div
                className="absolute top-0 left-0 h-2 rounded-full"
                style={{ width: `${item.value}%`, background: fill }}
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
          </div>
        )
      })}
    </div>
  )
}
