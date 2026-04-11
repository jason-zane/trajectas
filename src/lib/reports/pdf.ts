import { createAdminClient } from '@/lib/supabase/admin'
import { launchReportPdfBrowser } from '@/lib/reports/pdf-browser'
import { createReportPdfToken } from '@/lib/reports/pdf-token'
import type { ReportPdfStatus, ReportSnapshotStatus } from '@/types/database'

const REPORTS_BUCKET = 'reports'
const ACTIVE_PDF_STATUSES: ReportPdfStatus[] = ['queued', 'generating']

type SnapshotPdfRow = {
  id: string
  status: ReportSnapshotStatus
  pdf_url: string | null
  pdf_status: ReportPdfStatus | null
  pdf_error_message: string | null
}

export type ReportPdfStatusResponse = {
  status: ReportPdfStatus | 'idle'
  pdfUrl?: string
  error?: string
}

async function ensureReportsBucket() {
  const db = createAdminClient()
  const { data: bucket, error } = await db.storage.getBucket(REPORTS_BUCKET)

  if (bucket && !error) {
    return db
  }

  const { error: createError } = await db.storage.createBucket(REPORTS_BUCKET, {
    public: false,
    fileSizeLimit: 25 * 1024 * 1024,
    allowedMimeTypes: ['application/pdf'],
  })

  if (
    createError &&
    !createError.message.toLowerCase().includes('already exists')
  ) {
    throw createError
  }

  return db
}

function getAppUrl() {
  return (
    process.env.ADMIN_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3002'
  )
}

export function getReportPdfDownloadPath(snapshotId: string) {
  return `/api/reports/${snapshotId}/pdf`
}

export function mapReportPdfStatus(
  snapshot: Pick<SnapshotPdfRow, 'pdf_url' | 'pdf_status' | 'pdf_error_message'>,
  snapshotId: string,
): ReportPdfStatusResponse {
  if (snapshot.pdf_url) {
    return {
      status: 'ready',
      pdfUrl: getReportPdfDownloadPath(snapshotId),
    }
  }

  if (snapshot.pdf_status && snapshot.pdf_status !== 'ready') {
    return {
      status: snapshot.pdf_status,
      error: snapshot.pdf_error_message ?? undefined,
    }
  }

  return { status: 'idle' }
}

export async function getSnapshotPdfState(snapshotId: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('report_snapshots')
    .select('id, status, pdf_url, pdf_status, pdf_error_message')
    .eq('id', snapshotId)
    .maybeSingle<SnapshotPdfRow>()

  if (error) {
    throw error
  }

  return data
}

export async function queueReportPdfGeneration(snapshotId: string) {
  const snapshot = await getSnapshotPdfState(snapshotId)
  if (!snapshot) {
    throw new Error('Report not found')
  }

  if (!['ready', 'released'].includes(snapshot.status)) {
    throw new Error('PDF is only available for ready or released reports')
  }

  if (snapshot.pdf_url) {
    return {
      jobId: snapshotId,
      ...mapReportPdfStatus(snapshot, snapshotId),
      queued: false,
    }
  }

  if (snapshot.pdf_status && ACTIVE_PDF_STATUSES.includes(snapshot.pdf_status)) {
    return {
      jobId: snapshotId,
      ...mapReportPdfStatus(snapshot, snapshotId),
      queued: false,
    }
  }

  const db = createAdminClient()
  const { data: queued, error } = await db
    .from('report_snapshots')
    .update({
      pdf_status: 'queued',
      pdf_error_message: null,
    })
    .eq('id', snapshotId)
    .in('status', ['ready', 'released'])
    .is('pdf_url', null)
    .or('pdf_status.is.null,pdf_status.eq.failed,pdf_status.eq.ready')
    .select('id, status, pdf_url, pdf_status, pdf_error_message')
    .maybeSingle<SnapshotPdfRow>()

  if (error) {
    throw error
  }

  if (!queued) {
    const next = await getSnapshotPdfState(snapshotId)
    if (!next) {
      throw new Error('Report not found')
    }

    return {
      jobId: snapshotId,
      ...mapReportPdfStatus(next, snapshotId),
      queued: false,
    }
  }

  return {
    jobId: snapshotId,
    status: 'queued' as const,
    queued: true,
  }
}

export async function generateAndStoreReportPdf(
  snapshotId: string,
  options: { forceRefresh?: boolean } = {},
) {
  const db = createAdminClient()
  const snapshot = await getSnapshotPdfState(snapshotId)

  if (!snapshot) {
    throw new Error('Report not found')
  }

  if (!['ready', 'released'].includes(snapshot.status)) {
    throw new Error('PDF is only available for ready or released reports')
  }

  if (snapshot.pdf_url && !options.forceRefresh) {
    await db
      .from('report_snapshots')
      .update({
        pdf_status: 'ready',
        pdf_error_message: null,
      })
      .eq('id', snapshotId)

    return null
  }

  await db
    .from('report_snapshots')
    .update({
      pdf_status: 'generating',
      pdf_error_message: null,
    })
    .eq('id', snapshotId)

  const storagePath = `reports/${snapshotId}.pdf`
  let browser: Awaited<ReturnType<typeof launchReportPdfBrowser>> | null = null

  try {
    const url = `${getAppUrl()}/reports/${snapshotId}?format=print&pdfToken=${encodeURIComponent(
      createReportPdfToken(snapshotId),
    )}`

    browser = await launchReportPdfBrowser()
    const page = await browser.newPage()
    await page.emulateMediaType('print')

    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    })
    if (!response || !response.ok()) {
      throw new Error(
        `Print render failed with status ${response?.status() ?? 'unknown'}`,
      )
    }

    await page.waitForSelector('[data-print="true"]', { timeout: 10000 })
    await page.evaluate(async () => {
      if ('fonts' in document) {
        await document.fonts.ready
      }
    })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
    })
    const body = pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength,
    ) as ArrayBuffer

    const storage = await ensureReportsBucket()
    const { error: uploadError } = await storage.storage
      .from(REPORTS_BUCKET)
      .upload(storagePath, pdf, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      throw uploadError
    }

    const { error: updateError } = await storage
      .from('report_snapshots')
      .update({
        pdf_url: storagePath,
        pdf_status: 'ready',
        pdf_error_message: null,
      })
      .eq('id', snapshotId)

    if (updateError) {
      throw updateError
    }

    return {
      body,
      storagePath,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'PDF generation failed'

    await db
      .from('report_snapshots')
      .update({
        pdf_url: options.forceRefresh ? null : snapshot.pdf_url,
        pdf_status: 'failed',
        pdf_error_message: message,
      })
      .eq('id', snapshotId)

    throw error
  } finally {
    await browser?.close()
  }
}
