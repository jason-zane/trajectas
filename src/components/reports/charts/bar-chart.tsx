'use client'

import { cn } from '@/lib/utils'

interface BarChartProps {
  items: { name: string; value: number; band: 'high' | 'mid' | 'low' }[]
  showBandLabels?: boolean
  showScore?: boolean
  variant?: 'light' | 'dark'
  bandLabels?: { low: string; mid: string; high: string }
  className?: string
}

export function BarChart({
  items,
  showBandLabels = false,
  showScore = false,
  variant = 'light',
  bandLabels = { low: 'Low', mid: 'Mid', high: 'High' },
  className,
}: BarChartProps) {
  const isDark = variant === 'dark'

  return (
    <div className={cn('w-full', className)}>
      {items.map((item) => (
        <div
          key={item.name}
          className="grid items-center mb-3"
          style={{ gridTemplateColumns: '140px 1fr', gap: '12px' }}
        >
          {/* Label */}
          <div
            className="text-[13px] font-medium text-right"
            style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'var(--report-heading-colour)' }}
          >
            {item.name}
            {showScore && (
              <span
                className="ml-2 text-[11px]"
                style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'var(--report-muted-colour)' }}
              >
                {item.value}
              </span>
            )}
          </div>

          {/* Track + fill + dot */}
          <div
            className="relative h-2 rounded-full"
            style={{
              background: isDark ? 'rgba(255,255,255,0.15)' : 'var(--report-divider)',
              overflow: 'visible',
            }}
          >
            {/* Fill */}
            <div
              className="absolute top-0 left-0 h-2 rounded-full"
              style={{
                width: `${item.value}%`,
                background: `var(--report-${item.band}-band-fill)`,
              }}
            />
            {/* Dot indicator */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full"
              style={{
                left: `${item.value}%`,
                transform: 'translate(-50%, -50%)',
                background: 'var(--report-bar-dot)',
                border: `3px solid ${isDark ? 'var(--report-featured-bg)' : 'var(--report-page-bg)'}`,
              }}
            />
          </div>
        </div>
      ))}

      {/* Band labels row */}
      {showBandLabels && (
        <div
          className="grid mt-1"
          style={{ gridTemplateColumns: '140px 1fr', gap: '12px' }}
        >
          <div />
          <div
            className="flex justify-between text-[10px]"
            style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'var(--report-muted-colour)' }}
          >
            <span>{bandLabels.low}</span>
            <span>{bandLabels.mid}</span>
            <span>{bandLabels.high}</span>
          </div>
        </div>
      )}
    </div>
  )
}
