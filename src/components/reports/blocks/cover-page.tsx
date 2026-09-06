import { BrandLogo, BrandFooter } from "@/components/brand/brand-logo";
import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

interface CoverPageData {
  participantName?: string
  assessmentName?: string
  campaignName?: string
  reportName?: string
  /** @deprecated Use assessmentName instead */
  campaignTitle?: string
  generatedAt?: string
  clientName?: string
  primaryLogoUrl?: string
  secondaryLogoUrl?: string
  showDate?: boolean
  showLogo?: boolean
  showPoweredBy?: boolean
  poweredByText?: string
  showAssessmentName?: boolean
  showCampaignName?: boolean
  showReportName?: boolean
}

export function CoverPageBlock({ data }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as CoverPageData
  const showDate = d.showDate !== false
  const date = showDate && d.generatedAt
    ? new Date(d.generatedAt).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  // Eyebrow: the report name, unless it's already shown in the title fields.
  const eyebrow = (!d.showReportName && d.reportName ? d.reportName : 'Assessment Report').toUpperCase()

  const subtitle = d.showAssessmentName !== false && d.assessmentName
    ? d.assessmentName
    : d.campaignTitle ?? null
  const secondLineParts: string[] = []
  if (d.showCampaignName && d.campaignName) secondLineParts.push(d.campaignName)
  if (d.showReportName && d.reportName) secondLineParts.push(d.reportName)
  const secondLine = secondLineParts.join(' · ') || null

  return (
    <div
      className="relative flex min-h-[420px] flex-col overflow-hidden px-12 py-10 print:h-screen print:px-[18mm] print:py-[16mm]"
      style={{
        background: 'var(--report-featured-bg)',
        color: 'var(--report-featured-text)',
      }}
    >
      {/* Ghosted mark motif, bottom-right */}
      <div aria-hidden="true" className="absolute -right-1 -bottom-3 flex items-end gap-2.5">
        <span className="h-16 w-4 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <span className="h-24 w-4 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <span className="h-32 w-4 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <span className="h-40 w-4 rounded-full" style={{ background: 'var(--report-featured-accent)', opacity: 0.16 }} />
      </div>

      {/* Top row — co-brand left, confidential right */}
      <div className="relative flex items-start justify-between gap-4">
        {d.showLogo !== false ? (
          d.secondaryLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.secondaryLogoUrl} alt="Logo" className="h-9 object-contain" />
          ) : d.clientName ? (
            <p
              className="font-mono text-[11px] font-medium uppercase tracking-[0.2em]"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              {d.clientName}
            </p>
          ) : <span />
        ) : <span />}
        <p className="font-mono text-[10px] tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          CONFIDENTIAL
        </p>
      </div>

      <div className="flex-1" />

      {/* Title cluster */}
      <div className="relative">
        <p
          className="font-mono text-[11px] font-medium tracking-[0.26em]"
          style={{ color: 'var(--report-featured-accent)' }}
        >
          {eyebrow}
        </p>
        {d.participantName && (
          <h1 className="mt-3 text-4xl font-bold tracking-tight">{d.participantName}</h1>
        )}
        <div className="my-5 h-0.5 w-9" style={{ background: 'var(--report-featured-accent)' }} />
        {subtitle && (
          <p className="text-[15px]" style={{ color: 'rgba(255,255,255,0.65)' }}>{subtitle}</p>
        )}
        {secondLine && (
          <p className="mt-1 text-[12.5px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{secondLine}</p>
        )}
      </div>

      <div className="flex-1" />

      {/* Bottom row — date left, mark right */}
      <div className="relative flex items-end justify-between gap-4">
        <span className="font-mono text-[11px] tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {date ? date.toUpperCase() : ''}
        </span>
        {(d.showPoweredBy || d.showLogo !== false) && (
          <span className="flex flex-col items-end gap-2">
            {d.showLogo !== false ? (
              <BrandLogo name="Trajectas" logoUrl={d.primaryLogoUrl} light height={28} />
            ) : (
              <BrandFooter text={d.poweredByText || 'Powered by Trajectas'} light />
            )}
          </span>
        )}
      </div>
    </div>
  )
}
