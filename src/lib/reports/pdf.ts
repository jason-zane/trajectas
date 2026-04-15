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

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function getReportPdfFilename(snapshotId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from('report_snapshots')
    .select(`
      id,
      participant_sessions!inner(
        campaign_participants!inner(first_name, last_name),
        campaigns!inner(title)
      ),
      report_templates!inner(name, report_type)
    `)
    .eq('id', snapshotId)
    .maybeSingle()

  if (!data) return `report-${snapshotId}.pdf`

  const session = Array.isArray(data.participant_sessions)
    ? data.participant_sessions[0]
    : data.participant_sessions
  const cpRaw = session?.campaign_participants
  const participant = (Array.isArray(cpRaw) ? cpRaw[0] : cpRaw) as
    | { first_name: string | null; last_name: string | null }
    | undefined
  const campRaw = session?.campaigns
  const campaign = (Array.isArray(campRaw) ? campRaw[0] : campRaw) as { title: string | null } | undefined
  const tplRaw = data.report_templates
  const template = (Array.isArray(tplRaw) ? tplRaw[0] : tplRaw) as
    | { name: string | null; report_type: string | null }
    | undefined

  const parts: string[] = []
  const name = [participant?.first_name, participant?.last_name]
    .filter(Boolean)
    .join(' ')
  if (name) parts.push(name)
  if (template?.report_type) parts.push(template.report_type)
  if (campaign?.title) parts.push(campaign.title)

  if (parts.length === 0) return `report-${snapshotId}.pdf`

  return `${slugify(parts.join(' - '))}.pdf`
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
    const url = `${getAppUrl()}/print/reports/${snapshotId}?format=print&pdfToken=${encodeURIComponent(
      createReportPdfToken(snapshotId),
    )}`

    browser = await launchReportPdfBrowser()
    const page = await browser.newPage()
    // Full A4 viewport at 96 dpi — cover page uses 100vh to fill the page
    await page.setViewport({ width: 794, height: 1123 })
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
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
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
