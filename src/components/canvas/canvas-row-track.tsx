'use client'

import { cn } from '@/lib/utils'
import type { PersonStat } from '@/lib/canvas/summarize'

/**
 * The 0–100 track inside a breakdown row: one dot per person at their
 * current score, with a tail back to their first score when "Show change"
 * is on. A single person renders as a profile bar instead of a dot so the
 * solo view reads like the classic assessment report.
 *
 * The gold wash matches the hero chart's typical-range band (30–70).
 */

const TYPICAL_RANGE = { low: 30, high: 70 } as const

function x(value: number): string {
  const clamped = Math.max(0, Math.min(100, value))
  return `${(2 + clamped * 0.96).toFixed(2)}%`
}

export function CanvasRowTrack({
  stats,
  colourClasses,
  showChange,
}: {
  /** One entry per person, in people order. */
  stats: PersonStat[]
  /** Per-person `text-*` colour class, aligned with `stats` by index. */
  colourClasses: string[]
  showChange: boolean
}) {
  const solo = stats.length === 1
  const height = solo ? 28 : Math.max(34, 16 + stats.length * 7)
  const spacing = stats.length > 1 ? Math.min(8, (height - 12) / (stats.length - 1)) : 0
  const yFor = (i: number) => height / 2 + (i - (stats.length - 1) / 2) * spacing

  return (
    <svg
      width="100%"
      height={height}
      aria-hidden="true"
      className="block"
    >
      <rect
        x={x(TYPICAL_RANGE.low)}
        y={2}
        width={`${(TYPICAL_RANGE.high - TYPICAL_RANGE.low) * 0.96}%`}
        height={height - 4}
        fill="var(--gold)"
        opacity={0.09}
        className="dark:opacity-[0.14]"
      />
      {[0, 50, 100].map((v) => (
        <line
          key={v}
          x1={x(v)}
          x2={x(v)}
          y1={2}
          y2={height - 2}
          className="stroke-border/70"
          strokeWidth={1}
        />
      ))}
      {stats.map((s, i) => {
        if (s.latest === null) return null
        const y = yFor(i)
        const colour = colourClasses[i % colourClasses.length]
        const showTail = showChange && s.delta !== null && s.first !== null
        return (
          <g key={s.personKey} className={cn(colour)}>
            {solo && (
              <rect
                x={x(0)}
                y={y - 4}
                width={`${(Math.max(0, Math.min(100, s.latest)) * 0.96).toFixed(2)}%`}
                height={8}
                rx={3}
                fill="currentColor"
                opacity={0.75}
              />
            )}
            {showTail && (
              <>
                <line
                  x1={x(s.first as number)}
                  x2={x(s.latest)}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth={solo ? 0 : 2}
                  opacity={0.4}
                />
                <circle
                  cx={x(s.first as number)}
                  cy={y}
                  r={solo ? 0 : 2.5}
                  fill="var(--card)"
                  stroke="currentColor"
                  strokeWidth={1.4}
                  opacity={0.7}
                />
              </>
            )}
            {!solo && (
              <circle
                cx={x(s.latest)}
                cy={y}
                r={4.2}
                fill="currentColor"
                stroke="var(--card)"
                strokeWidth={1.4}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}
