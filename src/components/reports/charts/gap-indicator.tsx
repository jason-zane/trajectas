'use client'

import { cn } from '@/lib/utils'

interface GapIndicatorProps {
  items: {
    name: string
    selfScore: number
    othersScore: number
    gapType: 'blind_spot' | 'hidden_strength' | 'aligned'
  }[]
  className?: string
}

export function GapIndicator({ items, className }: GapIndicatorProps) {
  // Max possible gap is 100 (0 vs 100). We scale bar widths relative to 50% of the track.
  const maxGap = 50

  return (
    <div className={cn('w-full', className)}>
      {/* Rows */}
      {items.map((item) => {
        const gap = Math.abs(item.selfScore - item.othersScore)
        const isAligned = item.gapType === 'aligned'
        const isBlindSpot = item.gapType === 'blind_spot'
        // bar width as fraction of the half-track (cap at 100%)
        const barPct = Math.min((gap / maxGap) * 100, 100)

        return (
          <div
            key={item.name}
            className="grid items-center mb-3"
            style={{ gridTemplateColumns: '140px 1fr', gap: '12px' }}
          >
            {/* Label */}
            <div
              className="text-[13px] font-medium text-right"
              style={{ color: 'var(--report-heading-colour)' }}
            >
              {item.name}
            </div>

            {/* Diverging bar area */}
            <div className="relative flex items-center h-5">
              {/* Left half track */}
              <div
                className="flex-1 h-[6px] rounded-l-full relative flex justify-end items-center"
                style={{ background: 'var(--report-divider)' }}
              >
                {!isAligned && !isBlindSpot && (
                  // hidden strength: bar goes left from centre
                  <div
                    className="absolute right-0 h-[6px] rounded-l-full"
                    style={{
                      width: `${barPct}%`,
                      background: 'var(--report-rater-peers)',
                    }}
                  />
                )}
              </div>

              {/* Centre marker */}
              {isAligned ? (
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0 z-10"
                  style={{ background: 'var(--report-muted-colour)' }}
                />
              ) : (
                <div
                  className="w-px h-4 flex-shrink-0 z-10"
                  style={{ background: 'var(--report-muted-colour)' }}
                />
              )}

              {/* Right half track */}
              <div
                className="flex-1 h-[6px] rounded-r-full relative flex justify-start items-center"
                style={{ background: 'var(--report-divider)' }}
              >
                {!isAligned && isBlindSpot && (
                  // blind spot: bar goes right from centre
                  <div
                    className="absolute left-0 h-[6px] rounded-r-full"
                    style={{
                      width: `${barPct}%`,
                      background: 'var(--report-rater-self)',
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Direction labels */}
      <div
        className="grid mt-1"
        style={{ gridTemplateColumns: '140px 1fr', gap: '12px' }}
      >
        <div />
        <div
          className="flex justify-between text-[10px]"
          style={{ color: 'var(--report-muted-colour)' }}
        >
          <span>← Hidden Strengths</span>
          <span>Blind Spots →</span>
        </div>
      </div>
    </div>
  )
}
