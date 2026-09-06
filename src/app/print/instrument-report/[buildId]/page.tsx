import { TrajectasLogo } from "@/components/brand/trajectas-logo";
import { notFound } from 'next/navigation'
import { verifyInstrumentReportPdfToken } from '@/lib/reports/pdf-token'
import { createAdminClient } from '@/lib/supabase/admin'
import { assembleTechnicalReport } from '@/lib/instrument/technical-report-server'
import { TechnicalReportDocument } from '@/components/instruments/technical-report-document'

interface Props {
  params: Promise<{ buildId: string }>
  searchParams: Promise<{ pdfToken?: string }>
}

/**
 * Print/PDF rendering of the technical report.
 *
 * This renders the SAME document component as the on-screen view. The first
 * version of this route formatted raw DTOs itself and, in doing so, dropped the
 * evidence classes and the entire limitations section — meaning the PDF a
 * customer received would have omitted the part that says which figures are
 * forecasts. The shared component removes the possibility.
 *
 * Access is by signed, short-lived token rather than session cookie, because
 * the PDF renderer fetches this URL headlessly. The token is HMAC-signed,
 * bound to this buildId, and expires in minutes.
 */
export default async function PrintInstrumentReportPage({
  params,
  searchParams
}: Props) {
  const { buildId } = await params
  const { pdfToken } = await searchParams

  if (!verifyInstrumentReportPdfToken(pdfToken, buildId)) {
    notFound()
  }

  const db = createAdminClient()
  const assembled = await assembleTechnicalReport(db, buildId, new Date())

  if (!assembled) {
    notFound()
  }

  const { report, instrumentName } = assembled

  return (
    <div data-print="true" className="w-full bg-white text-black print-report">
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: white; }
          .print-report { color: black; background: white; }
          .page-break { page-break-after: always; }
          section { break-inside: avoid; }
        }
      `}</style>

      <div className="page-break flex flex-col items-center justify-center gap-8 px-12 py-24 text-center">
        <TrajectasLogo variant="horizontal" height={32} />
        <div>
          <h1 className="text-4xl font-bold">{instrumentName}</h1>
          <p className="mt-2 text-lg text-gray-600">Technical Report</p>
        </div>
        <div className="space-y-1 text-sm text-gray-600">
          <p className="capitalize">{report.identity.measureType}</p>
          <p>
            Generated{' '}
            {new Date(report.identity.generatedAt).toISOString().slice(0, 10)}
          </p>
          <p className="font-mono text-xs">{report.identity.buildId}</p>
        </div>
      </div>

      <div className="px-12 py-8">
        <TechnicalReportDocument report={report} />
      </div>
    </div>
  )
}
