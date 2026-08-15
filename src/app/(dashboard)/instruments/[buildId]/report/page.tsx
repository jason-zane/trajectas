import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { PageHeader } from '@/components/page-header'
import { assembleTechnicalReport } from '@/lib/instrument/technical-report-server'
import { TechnicalReportDocument } from '@/components/instruments/technical-report-document'
import { DownloadReportButton } from './download-report-button'

interface Props {
  params: Promise<{ buildId: string }>
}

export default async function TechnicalReportPage({ params }: Props) {
  const { buildId } = await params

  await requireAdminScope()

  const db = createAdminClient()
  // Both this view and the print/PDF route go through the same assembler, so a
  // customer's PDF cannot say something different from what is on screen.
  const assembled = await assembleTechnicalReport(db, buildId, new Date())

  if (!assembled) {
    notFound()
  }

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader
        eyebrow={assembled.instrumentName}
        title="Technical Report"
        description="The evidence behind this instrument, and the limits of that evidence."
      >
        <DownloadReportButton buildId={buildId} />
      </PageHeader>

      <TechnicalReportDocument report={assembled.report} />
    </div>
  )
}
