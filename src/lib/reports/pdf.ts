import { createAdminClient } from '@/lib/supabase/admin'
import { reportError } from '@/lib/observability/report-error'
import { notifyConsultantsForSnapshot } from '@/lib/notifications/consultant-notification'
import { withReportPdfBrowser } from '@/lib/reports/pdf-browser'
import { createReportPdfToken } from '@/lib/reports/pdf-token'
import { requireAppUrl } from '@/lib/hosts'
import type { ReportPdfStatus, ReportSnapshotStatus } from '@/types/database'

const REPORTS_BUCKET = 'reports'
const ACTIVE_PDF_STATUSES: ReportPdfStatus[] = ['queued', 'generating']
// Chromium can consume most of a function's memory. Other invocations on this
// process leave work durably queued instead of launching another browser.
let pdfRunning = false

type SnapshotPdfRow = {
  id: string
  status: ReportSnapshotStatus
  pdf_url: string | null
  pdf_status: ReportPdfStatus | null
  pdf_error_message: string | null
  pdf_attempt_count: number
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
  return requireAppUrl('admin')
}

export function getReportPdfDownloadPath(snapshotId: string) {
  return `/api/reports/${snapshotId}/pdf`
}

// Report PDF naming lives in one place so the download path and the email
// attachment paths can't drift apart. See pdf-filename.ts for the convention.
export { getReportPdfFilename } from '@/lib/reports/pdf-filename'

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
    .select('id, status, pdf_url, pdf_status, pdf_error_message, pdf_attempt_count')
    .eq('id', snapshotId)
    .maybeSingle<SnapshotPdfRow>()

  if (error) {
    throw error
  }

  return data
}

export async function queueReportPdfGeneration(snapshotId: string, options: { forceRefresh?: boolean } = {}) {
  const snapshot = await getSnapshotPdfState(snapshotId)
  if (!snapshot) {
    throw new Error('Report not found')
  }

  if (!['ready', 'released'].includes(snapshot.status)) {
    throw new Error('PDF is only available for ready or released reports')
  }

  if (snapshot.pdf_url && !options.forceRefresh) {
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
  let query = db
    .from('report_snapshots')
    .update({
      pdf_status: 'queued',
      pdf_error_message: null,
      pdf_attempt_count: 0,
      pdf_claim_token: null,
      pdf_started_at: null,
      pdf_next_attempt_at: null,
      ...(options.forceRefresh ? { pdf_url: null } : {}),
    })
    .eq('id', snapshotId)
    .in('status', ['ready', 'released'])
    .or('pdf_status.is.null,pdf_status.eq.failed,pdf_status.eq.ready')
  if (!options.forceRefresh) query = query.is('pdf_url', null)
  const { data: queued, error } = await query
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

  if (snapshot.pdf_status !== 'queued' && snapshot.pdf_status !== 'generating') {
    await queueReportPdfGeneration(snapshotId, options)
  }
  if (pdfRunning) return { queued: true as const }
  pdfRunning = true
  let claimToken: string | null = null
  let storagePath = ''

  try {
    const claim = await db.rpc('claim_report_pdf_generation', { p_snapshot_id: snapshotId })
    if (claim.error) throw claim.error
    if (!claim.data) return { queued: true as const }
    claimToken = claim.data as string
    // Each claim writes its own object. A stale worker can never overwrite
    // the object of a newer claim even if it resumes after lease recovery.
    storagePath = `reports/${snapshotId}/${claimToken}.pdf`
    const url = `${getAppUrl()}/print/reports/${snapshotId}?format=print&pdfToken=${encodeURIComponent(
      createReportPdfToken(snapshotId),
    )}`

    const pdf = await withReportPdfBrowser(async (browser) => {
      const page = await browser.newPage()
      page.setDefaultTimeout(15_000)
      // Full A4 viewport at 96 dpi — cover page uses 100vh to fill the page.
      await page.setViewport({ width: 794, height: 1123 })
      await page.emulateMediaType('print')

      const response = await page.goto(url, { waitUntil: 'networkidle0', timeout: 15_000 })
      if (!response || !response.ok()) {
        throw new Error(`Print render failed with status ${response?.status() ?? 'unknown'}`)
      }

      await page.waitForSelector('[data-print="true"]', { timeout: 5_000 })
      await page.evaluate(async () => {
        if ('fonts' in document) {
          await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 5_000))])
        }
      })
      // Pagination is a soft wait; its fallback still produces a usable PDF.
      await page.waitForSelector('html[data-pagination-ready="true"]', { timeout: 5_000 }).catch(() => {})

      return page.pdf({
        timeout: 20_000,
        format: 'A4',
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      })
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

    const { data: completedRows, error: updateError } = await storage
      .from('report_snapshots')
      .update({
        pdf_url: storagePath,
        pdf_status: 'ready',
        pdf_error_message: null,
        pdf_claim_token: null,
        pdf_started_at: null,
        pdf_next_attempt_at: null,
      })
      .eq('id', snapshotId)
      .eq('pdf_claim_token', claimToken)
      .select('id')

    if (updateError) throw updateError
    if (!completedRows?.length) throw new Error('PDF claim expired before completion')

    try {
      await notifyConsultantsForSnapshot(snapshotId)
    } catch (notifyError) {
      await reportError(notifyError, {
        source: 'notifications.consultant',
        severity: 'error',
        alert: true,
        context: { snapshotId, phase: 'post-pdf' },
      })
    }

    return {
      body,
      storagePath,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'PDF generation failed'

    const failure = claimToken ? await db.rpc('fail_report_pdf_generation', {
      p_snapshot_id: snapshotId, p_claim_token: claimToken, p_error: message,
    }) : null

    await reportError(error, { source: 'reports.pdf', severity: 'error',
      alert: failure?.data === 'failed' || !!failure?.error,
      context: { snapshotId, retryStatus: failure?.data, retryPersistFailed: !!failure?.error } })
    throw error
  } finally {
    pdfRunning = false
  }
}
