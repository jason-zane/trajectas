import type { CoverPageConfig } from '@/lib/reports/types'

interface CoverPageData extends CoverPageConfig {
  participantName?: string
  campaignTitle?: string
  partnerLogoUrl?: string
  generatedAt?: string
}

export function CoverPageBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as CoverPageData
  const date = d.showDate && d.generatedAt
    ? new Date(d.generatedAt).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-16 text-center print:min-h-screen print:py-24">
      {d.showLogo && d.partnerLogoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.partnerLogoUrl} alt="Partner logo" className="h-12 mb-12 object-contain" />
      )}
      <div className="space-y-4">
        {d.participantName && (
          <h1 className="text-4xl font-semibold tracking-tight">{d.participantName}</h1>
        )}
        {d.subtitle && (
          <p className="text-xl text-muted-foreground">{d.subtitle}</p>
        )}
        {d.campaignTitle && (
          <p className="text-lg text-muted-foreground">{d.campaignTitle}</p>
        )}
        {date && (
          <p className="text-sm text-muted-foreground mt-8">{date}</p>
        )}
      </div>
    </div>
  )
}
