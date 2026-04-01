import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

interface CoverPageData {
  participantName?: string
  campaignTitle?: string
  generatedAt?: string
  organizationName?: string
  primaryLogoUrl?: string
  secondaryLogoUrl?: string
  showDate?: boolean
  showLogo?: boolean
  showPoweredBy?: boolean
  poweredByText?: string
}

export function CoverPageBlock({ data }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as CoverPageData
  const showDate = d.showDate !== false
  const date = showDate && d.generatedAt
    ? new Date(d.generatedAt).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] py-16 text-center print:min-h-screen print:py-24">
      {/* Logo or org name fallback */}
      {d.showLogo !== false && (
        d.primaryLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={d.primaryLogoUrl}
            alt="Logo"
            className="h-12 mb-12 object-contain"
          />
        ) : d.organizationName ? (
          <p
            className="text-sm font-semibold uppercase tracking-[3px] mb-12"
            style={{ color: 'var(--report-featured-accent)' }}
          >
            {d.organizationName}
          </p>
        ) : null
      )}

      {/* Main content */}
      <div className="space-y-4">
        {d.participantName && (
          <h1 className="text-4xl font-semibold tracking-tight">{d.participantName}</h1>
        )}
        {d.campaignTitle && (
          <p className="text-lg opacity-60">{d.campaignTitle}</p>
        )}
        {date && (
          <p className="text-sm opacity-50 mt-8">{date}</p>
        )}
      </div>

      {/* Secondary logo / Powered by */}
      {(d.showLogo !== false || d.showPoweredBy) && (
        <div className="mt-16 flex flex-col items-center gap-2">
          {d.showPoweredBy && d.poweredByText && (
            <p className="text-[10px] uppercase tracking-[2px] opacity-40">
              {d.poweredByText}
            </p>
          )}
          {d.showLogo !== false && d.secondaryLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={d.secondaryLogoUrl}
              alt="Secondary logo"
              className="h-8 object-contain opacity-60"
            />
          )}
        </div>
      )}
    </div>
  )
}
