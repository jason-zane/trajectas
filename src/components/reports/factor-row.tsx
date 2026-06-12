'use client'

// =============================================================================
// FactorRow — the universal score entry used across report blocks.
//
// Anatomy never changes with factor count: a spine line (name + band label +
// score) over a full-width ticked bar. Depth adds layers beneath the spine:
//   glance    → spine only
//   standard  → + description
//   rich      → + low/high anchors flanking the bar ends
//   full      → + behavioural indicators and development focus
// The name owns the whole line so it can never truncate.
// =============================================================================

import { cn } from '@/lib/utils'
import {
  getBandColour,
  getBandTextColour,
  type PaletteKey,
  type BandDefinition,
} from '@/lib/reports/band-scheme'
import { computeTickPositions } from './charts/ticked-bar'
import type { BandResult } from '@/lib/reports/types'
import type { ReportDepth } from '@/lib/reports/presentation'

export interface FactorRowProps {
  name: string
  pompScore: number
  bandResult: BandResult
  palette: PaletteKey
  /** Band definitions for boundary ticks on the bar. Omit to render no ticks. */
  bands?: BandDefinition[]
  depth?: ReportDepth
  /** Pre-sanitised HTML (definition/description from the library). */
  description?: string | null
  anchorLow?: string | null
  anchorHigh?: string | null
  /** Pre-sanitised HTML — band-tier behavioural indicator narrative. */
  indicators?: string | null
  /** Pre-sanitised HTML — development focus text. */
  development?: string | null
  showScore?: boolean
  showBandLabel?: boolean
  variant?: 'light' | 'dark'
  /** Compact spacing for dense single-page summaries. */
  size?: 'default' | 'compact'
  className?: string
}

export function FactorRow({
  name,
  pompScore,
  bandResult,
  palette,
  bands,
  depth = 'glance',
  description,
  anchorLow,
  anchorHigh,
  indicators,
  development,
  showScore = true,
  showBandLabel = true,
  variant = 'light',
  size = 'default',
  className,
}: FactorRowProps) {
  const isDark = variant === 'dark'
  const fill = getBandColour(palette, bandResult.bandIndex, bandResult.bandCount)
  const labelColour = isDark
    ? 'rgba(255,255,255,0.75)'
    : getBandTextColour(palette, bandResult.bandIndex, bandResult.bandCount)
  const ticks = bands ? computeTickPositions(bands) : []
  const compact = size === 'compact'

  const showDescription = depth !== 'glance' && hasText(description)
  const showAnchors = (depth === 'rich' || depth === 'full') && (hasText(anchorLow) || hasText(anchorHigh))
  const showIndicators = depth === 'full' && hasText(indicators)
  const showDevelopment = depth === 'full' && hasText(development)

  return (
    <div className={cn('report-entry', compact ? 'py-1.5' : 'py-2.5', className)}>
      {/* Spine line — name owns the full line; label + score cluster right */}
      <div className={cn('flex items-baseline gap-2.5', compact ? 'mb-1' : 'mb-1.5')}>
        <span
          className={cn('flex-1 font-semibold', compact ? 'text-[12px]' : 'text-[13px]')}
          style={{ color: isDark ? 'rgba(255,255,255,0.9)' : 'var(--report-heading-colour)' }}
        >
          {name}
        </span>
        {showBandLabel && bandResult.bandLabel && (
          <span className="shrink-0 text-[11px]" style={{ color: labelColour }}>
            {bandResult.bandLabel}
          </span>
        )}
        {showScore && (
          <span
            className={cn(
              'shrink-0 font-semibold tabular-nums text-right',
              compact ? 'text-[12px] min-w-6' : 'text-[13px] min-w-7',
            )}
            style={{ color: isDark ? 'rgba(255,255,255,0.9)' : 'var(--report-heading-colour)' }}
          >
            {Math.round(pompScore)}
          </span>
        )}
      </div>

      {/* Full-width ticked bar */}
      <div
        className={cn('relative rounded-full', compact ? 'h-[4px]' : 'h-[6px]')}
        style={{ background: isDark ? 'rgba(255,255,255,0.15)' : 'var(--report-divider)' }}
      >
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute -top-0.5 -bottom-0.5 w-px -translate-x-1/2"
            style={{ left: `${t}%`, background: isDark ? 'rgba(255,255,255,0.25)' : 'var(--report-card-border)' }}
          />
        ))}
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, pompScore))}%`, background: fill }}
        />
      </div>

      {/* Rich layer — low/high anchors flank the bar ends */}
      {showAnchors && (
        <div className="mt-2 flex justify-between gap-6">
          <div className="max-w-[46%] text-[11px] leading-snug" style={{ color: mutedColour(isDark) }}>
            {hasText(anchorLow) && (
              <>
                <span className="font-mono text-[10px] tracking-[0.12em] opacity-70">LOW</span>
                <br />
                {anchorLow}
              </>
            )}
          </div>
          <div className="max-w-[46%] text-right text-[11px] leading-snug" style={{ color: mutedColour(isDark) }}>
            {hasText(anchorHigh) && (
              <>
                <span className="font-mono text-[10px] tracking-[0.12em] opacity-70">HIGH</span>
                <br />
                {anchorHigh}
              </>
            )}
          </div>
        </div>
      )}

      {/* Standard layer — description */}
      {showDescription && (
        <div
          className="mt-2 text-[12px] leading-relaxed [&_p]:m-0"
          style={{ color: bodyColour(isDark) }}
          dangerouslySetInnerHTML={{ __html: description! }}
        />
      )}

      {/* Full layer — behavioural indicators */}
      {showIndicators && (
        <div className="mt-3">
          <p
            className="mb-1.5 font-mono text-[10px] font-medium tracking-[0.14em]"
            style={{ color: mutedColour(isDark) }}
          >
            BEHAVIOURAL INDICATORS
          </p>
          <div
            className="text-[12px] leading-relaxed [&_p]:m-0 [&_ul]:m-0 [&_ul]:pl-4"
            style={{ color: bodyColour(isDark) }}
            dangerouslySetInnerHTML={{ __html: indicators! }}
          />
        </div>
      )}

      {/* Full layer — development focus inset */}
      {showDevelopment && (
        <div
          className="mt-3 px-4 py-3"
          style={{
            background: isDark ? 'rgba(255,255,255,0.08)' : 'var(--report-inset-bg)',
            borderLeft: '3px solid var(--report-featured-accent)',
          }}
        >
          <p
            className="mb-1 font-mono text-[10px] font-medium tracking-[0.14em]"
            style={{ color: mutedColour(isDark) }}
          >
            DEVELOPMENT FOCUS
          </p>
          <div
            className="text-[12px] leading-relaxed [&_p]:m-0"
            style={{ color: bodyColour(isDark) }}
            dangerouslySetInnerHTML={{ __html: development! }}
          />
        </div>
      )}
    </div>
  )
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.replace(/<[^>]*>/g, '').trim().length > 0
}

function bodyColour(isDark: boolean): string {
  return isDark ? 'rgba(255,255,255,0.75)' : 'var(--report-body-colour)'
}

function mutedColour(isDark: boolean): string {
  return isDark ? 'rgba(255,255,255,0.55)' : 'var(--report-muted-colour)'
}
