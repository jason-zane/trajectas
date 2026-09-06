import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { drainReportPdfJobs } from '@/lib/reports/pdf-jobs'
import { reportError } from '@/lib/observability/report-error'
import {
  getSnapshotPdfState,
  queueReportPdfGeneration,
} from '@/lib/reports/pdf'
import { parseReportPdfRefreshTargets } from '@/lib/reports/pdf-refresh'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET
  if (!expected) return Response.json({ error: 'Cron is not configured' }, { status: 503 })
  const provided = Buffer.from(request.headers.get('authorization') ?? '')
  const authorized = Buffer.from(`Bearer ${expected}`)
  if (provided.length !== authorized.length || !timingSafeEqual(provided, authorized)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const db = createAdminClient()
    const recovery = await db.rpc('recover_report_pdf_jobs')
    if (recovery.error) throw recovery.error
    const refreshTargets = parseReportPdfRefreshTargets()
    let refreshQueued = 0
    for (const target of refreshTargets) {
      const snapshot = await getSnapshotPdfState(target.snapshotId)
      if (snapshot?.pdf_url !== target.sourcePdfUrl) continue
      const queued = await queueReportPdfGeneration(target.snapshotId, { forceRefresh: true })
      if (queued.queued) refreshQueued++
    }
    const suppressConsultantNotificationFor = new Set(
      refreshTargets.map((target) => target.snapshotId),
    )
    const result = await drainReportPdfJobs({
      client: db,
      timeBudgetMs: 180_000,
      suppressConsultantNotificationFor: (snapshotId) =>
        suppressConsultantNotificationFor.has(snapshotId),
    })
    return Response.json({
      ok: true,
      recovered: recovery.data,
      pdfRefresh: { configured: refreshTargets.length, queued: refreshQueued },
      ...result,
    })
  } catch (error) {
    await reportError(error, { source: 'cron.report-pdf-sweep', severity: 'error', alert: true })
    return Response.json({ error: 'PDF sweep failed' }, { status: 500 })
  }
}
