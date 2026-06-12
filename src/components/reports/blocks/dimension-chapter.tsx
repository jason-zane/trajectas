'use client'

// =============================================================================
// Dimension Chapter block — a repeater that renders one chapter per dimension:
// hero (eyebrow, name, band chip, score, ticked bar, summary) followed by the
// dimension's factors as FactorRows at the configured depth.
//
// Print flow (chapterFlow config):
//   auto       → short chapters (≤3 factors at glance/standard depth) keep
//                together so they pack onto shared pages; long chapters may
//                split between factor entries (entries themselves are atomic)
//   new_page   → every chapter starts on a fresh page
//   continuous → no constraints beyond atomic entries
// =============================================================================

import { FactorRow } from '../factor-row'
import {
  getBandColour,
  getBandChipColours,
  type PaletteKey,
  type BandDefinition,
} from '@/lib/reports/band-scheme'
import { computeTickPositions } from '../charts/ticked-bar'
import type { BandResult, DimensionChapterConfig } from '@/lib/reports/types'
import type { PresentationMode, ChartType, ReportDepth } from '@/lib/reports/presentation'

interface ChapterFactor {
  entityId: string
  entityName: string
  pompScore: number
  bandResult: BandResult
  description?: string | null
  anchorLow?: string | null
  anchorHigh?: string | null
  indicators?: string | null
  development?: string | null
}

interface Chapter {
  dimensionId: string
  dimensionName: string
  pompScore: number
  bandResult: BandResult
  summary?: string | null
  factors: ChapterFactor[]
}

interface DimensionChapterData {
  chapters: Chapter[]
  palette: PaletteKey
  bands?: BandDefinition[]
  config: DimensionChapterConfig
  _empty?: boolean
}

export function DimensionChapterBlock({ data, mode }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as DimensionChapterData
  if (d._empty || !d.chapters?.length) return null

  const isDark = mode === 'featured'
  const depth: ReportDepth = d.config?.depth ?? 'standard'
  const flow = d.config?.chapterFlow ?? 'auto'
  const showSummary = d.config?.showDimensionSummary !== false
  const ticks = d.bands ? computeTickPositions(d.bands) : []

  return (
    <div>
      {d.chapters.map((chapter, i) => {
        // Auto-pack: small, shallow chapters stay atomic so the browser packs
        // them onto shared pages; anything bigger may split between entries.
        const keepTogether =
          flow === 'auto' &&
          chapter.factors.length <= 3 &&
          (depth === 'glance' || depth === 'standard')

        return (
          <section
            key={chapter.dimensionId}
            data-pg-section
            data-toc-target={`dim:${chapter.dimensionId}`}
            data-pg-atomic={keepTogether ? 'true' : undefined}
            data-pg-break-before={flow === 'new_page' && i > 0 ? 'true' : undefined}
            className={
              flow === 'new_page' && i > 0 ? 'print:break-before-page' : undefined
            }
            style={keepTogether ? { breakInside: 'avoid' } : undefined}
          >
            <div
              data-pg-atomic
              className={i > 0 ? 'mt-10 print:mt-8' : undefined}
              style={{ breakInside: 'avoid', breakAfter: 'avoid' }}
            >
              <p
                className="font-mono text-[10px] font-medium tracking-[0.22em]"
                style={{ color: 'var(--report-featured-accent)' }}
              >
                DIMENSION {String(i + 1).padStart(2, '0')} / {String(d.chapters.length).padStart(2, '0')}
              </p>
              <div className="mt-1.5 flex items-end justify-between gap-4">
                <h3
                  className="text-xl font-bold tracking-tight"
                  style={{ color: isDark ? 'currentColor' : 'var(--report-heading-colour)' }}
                >
                  {chapter.dimensionName}
                </h3>
                <div className="flex shrink-0 items-center gap-2.5">
                  <BandChip bandResult={chapter.bandResult} palette={d.palette} />
                  <span
                    className="text-lg font-semibold tabular-nums"
                    style={{ color: isDark ? 'currentColor' : 'var(--report-cover-accent)' }}
                  >
                    {Math.round(chapter.pompScore)}
                  </span>
                </div>
              </div>

              <div
                className="relative mt-2.5 h-[7px] rounded-full"
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
                  style={{
                    width: `${Math.max(0, Math.min(100, chapter.pompScore))}%`,
                    background: getBandColour(d.palette, chapter.bandResult.bandIndex, chapter.bandResult.bandCount),
                  }}
                />
              </div>

              {showSummary && hasText(chapter.summary) && (
                <div
                  className="mt-3 text-[12.5px] leading-relaxed [&_p]:m-0"
                  style={{ color: isDark ? 'rgba(255,255,255,0.75)' : 'var(--report-body-colour)' }}
                  dangerouslySetInnerHTML={{ __html: chapter.summary! }}
                />
              )}
            </div>

            <div className="mt-3">
              {chapter.factors.map((factor, fi) => (
                <div
                  key={factor.entityId}
                  className={fi < chapter.factors.length - 1 ? 'border-b' : undefined}
                  style={fi < chapter.factors.length - 1 ? { borderColor: 'var(--report-divider)' } : undefined}
                >
                  <FactorRow
                    name={factor.entityName}
                    pompScore={factor.pompScore}
                    bandResult={factor.bandResult}
                    palette={d.palette}
                    bands={d.bands}
                    depth={depth}
                    description={factor.description}
                    anchorLow={factor.anchorLow}
                    anchorHigh={factor.anchorHigh}
                    indicators={factor.indicators}
                    development={factor.development}
                    variant={isDark ? 'dark' : 'light'}
                  />
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function BandChip({ bandResult, palette }: { bandResult: BandResult; palette: PaletteKey }) {
  const chip = getBandChipColours(palette, bandResult.bandIndex, bandResult.bandCount)
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: chip.bg, color: chip.text }}
    >
      {bandResult.bandLabel}
    </span>
  )
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.replace(/<[^>]*>/g, '').trim().length > 0
}
