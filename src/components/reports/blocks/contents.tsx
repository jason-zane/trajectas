'use client'

// =============================================================================
// Contents block — table of contents derived from the template's other blocks.
// Dimension rows carry their score; the band legend panel explains the scale
// once so no other page needs a legend. (Page numbers require the measured
// pagination pass — deliberately omitted for now.)
// =============================================================================

import {
  getBandColour,
  getBandTextColour,
  type PaletteKey,
  type BandDefinition,
} from '@/lib/reports/band-scheme'
import type { ContentsConfig } from '@/lib/reports/types'
import type { ContentsSection } from '@/lib/reports/contents-sections'
import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

interface ContentsData {
  sections: ContentsSection[]
  bands?: BandDefinition[]
  palette: PaletteKey
  config: ContentsConfig
}

export function ContentsBlock({ data }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as ContentsData
  if (!d.sections?.length) return null

  const showLegend = d.config?.showBandLegend !== false

  return (
    <div>
      <div className="report-entry">
        {d.sections.map((section, i) => (
          <div key={`${section.label}-${i}`} className="flex items-baseline gap-2.5 py-2">
            <span
              className="shrink-0 font-mono text-[11px] tabular-nums"
              style={{ color: 'var(--report-featured-accent)' }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <span
              className="shrink-0 text-[13px] font-semibold"
              style={{ color: 'var(--report-heading-colour)' }}
            >
              {section.label}
            </span>
            {section.kind === 'dimension' && section.bandResult && (
              <span className="flex shrink-0 items-center gap-1.5">
                <span
                  className="size-[7px] rounded-full"
                  style={{
                    background: getBandColour(d.palette, section.bandResult.bandIndex, section.bandResult.bandCount),
                  }}
                />
                <span
                  className="font-mono text-[11px] font-semibold tabular-nums"
                  style={{ color: 'var(--report-heading-colour)' }}
                >
                  {Math.round(section.pompScore ?? 0)}
                </span>
              </span>
            )}
            <span
              className="flex-1 -translate-y-[3px] border-b border-dotted"
              style={{ borderColor: 'var(--report-card-border)' }}
            />
          </div>
        ))}
      </div>

      {showLegend && d.bands && d.bands.length > 0 && (
        <div
          className="report-entry mt-6 rounded-lg px-4 py-3.5"
          style={{ background: 'var(--report-inset-bg)' }}
        >
          <p
            className="mb-2.5 font-mono text-[10px] font-medium tracking-[0.18em]"
            style={{ color: 'var(--report-muted-colour)' }}
          >
            HOW TO READ
          </p>
          <div className="space-y-1.5">
            {d.bands.map((band, i) => (
              <div key={band.key} className="flex items-center gap-2">
                <span
                  className="size-[7px] shrink-0 rounded-full"
                  style={{ background: getBandColour(d.palette, i, d.bands!.length) }}
                />
                <span
                  className="text-[11.5px]"
                  style={{ color: getBandTextColour(d.palette, i, d.bands!.length) }}
                >
                  {band.label}
                  <span style={{ color: 'var(--report-muted-colour)' }}>
                    {' '}· {band.min}–{band.max}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] leading-snug" style={{ color: 'var(--report-muted-colour)' }}>
            Scores run 0–100. Ticks on each bar mark the band boundaries.
          </p>
        </div>
      )}
    </div>
  )
}
