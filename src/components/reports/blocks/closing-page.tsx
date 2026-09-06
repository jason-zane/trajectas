'use client'

import { TrajectasLogo } from "@/components/brand/trajectas-logo";

// =============================================================================
// Closing Page block — the credibility page: methodology in plain language,
// what the score bands mean, the development-not-selection confidentiality
// note, and the Trajectas mark. Custom copy comes from config (sanitised
// upstream); sensible defaults otherwise.
// =============================================================================

import {
  getBandColour,
  getBandTextColour,
  type PaletteKey,
  type BandDefinition,
} from '@/lib/reports/band-scheme'
import type { ClosingPageConfig } from '@/lib/reports/types'
import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

interface ClosingPageData extends ClosingPageConfig {
  bands?: BandDefinition[]
  palette: PaletteKey
  clientName?: string
}

const DEFAULT_METHODOLOGY =
  'Scores reflect responses across the behavioural items of this assessment, aggregated to factor and dimension level on a 0–100 scale. Higher scores indicate more consistent demonstration of the behaviours measured.'

const DEFAULT_CONFIDENTIALITY =
  'This report was prepared for the named participant. Results are a snapshot intended for development, not a measure of worth or a sole basis for selection decisions.'

export function ClosingPageBlock({ data }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as ClosingPageData
  const showLegend = d.showBandLegend !== false
  const methodology = hasText(d.methodologyText) ? d.methodologyText! : null
  const confidentiality = hasText(d.confidentialityText) ? d.confidentialityText! : null

  return (
    <div className="report-entry">
      <SectionLabel>METHODOLOGY</SectionLabel>
      {methodology ? (
        <div
          className="mb-5 text-[12.5px] leading-relaxed [&_p]:m-0"
          style={{ color: 'var(--report-body-colour)' }}
          dangerouslySetInnerHTML={{ __html: methodology }}
        />
      ) : (
        <p className="mb-5 text-[12.5px] leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
          {DEFAULT_METHODOLOGY}
        </p>
      )}

      {showLegend && d.bands && d.bands.length > 0 && (
        <>
          <SectionLabel>SCORE BANDS</SectionLabel>
          <div className="mb-5 space-y-1.5">
            {d.bands.map((band, i) => (
              <div key={band.key} className="flex items-center gap-2">
                <span
                  className="size-[7px] shrink-0 rounded-full"
                  style={{ background: getBandColour(d.palette, i, d.bands!.length) }}
                />
                <span
                  className="text-[12px]"
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
        </>
      )}

      <SectionLabel>CONFIDENTIALITY</SectionLabel>
      {confidentiality ? (
        <div
          className="text-[12.5px] leading-relaxed [&_p]:m-0"
          style={{ color: 'var(--report-body-colour)' }}
          dangerouslySetInnerHTML={{ __html: confidentiality }}
        />
      ) : (
        <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--report-body-colour)' }}>
          {DEFAULT_CONFIDENTIALITY}
        </p>
      )}

      <div
        className="mt-8 flex items-center justify-between border-t pt-4"
        style={{ borderColor: 'var(--report-divider)' }}
      >
        <TrajectasLogo variant="horizontal" height={24} />
        {d.clientName && (
          <span
            className="font-mono text-[10px] tracking-[0.18em] uppercase"
            style={{ color: 'var(--report-muted-colour)' }}
          >
            FOR {d.clientName}
          </span>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-1.5 font-mono text-[10px] font-medium tracking-[0.18em]"
      style={{ color: 'var(--report-muted-colour)' }}
    >
      {children}
    </p>
  )
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.replace(/<[^>]*>/g, '').trim().length > 0
}
