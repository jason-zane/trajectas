import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAndStoreReportPdf } from '@/lib/reports/pdf'

export async function drainReportPdfJobs(options: {
  client?: ReturnType<typeof createAdminClient>
  timeBudgetMs?: number
  generate?: typeof generateAndStoreReportPdf
  suppressConsultantNotificationFor?: (snapshotId: string) => boolean
} = {}) {
  const db = options.client ?? createAdminClient()
  const generate = options.generate ?? generateAndStoreReportPdf
  const started = Date.now()
  let processed = 0, failed = 0
  // Sequential per worker keeps Chromium memory bounded. The database claim
  // also limits concurrent workers across instances, routes and cron runs.
  for (let round = 0; round < 100; round++) {
    if (Date.now() - started >= (options.timeBudgetMs ?? 180_000)) break
    const { data, error } = await db.from('report_snapshots').select('id')
      .eq('pdf_status', 'queued').is('pdf_url', null)
      .in('status', ['ready', 'released'])
      .or(`pdf_next_attempt_at.is.null,pdf_next_attempt_at.lte.${new Date().toISOString()}`)
      .order('created_at', { ascending: true }).limit(1)
    if (error) throw error
    if (!data?.length) break
    try {
      const suppressConsultantNotification = options.suppressConsultantNotificationFor?.(data[0].id)
      const result = suppressConsultantNotification
        ? await generate(data[0].id, { suppressConsultantNotification: true })
        : await generate(data[0].id)
      if (result && 'queued' in result) break // capacity occupied; no busy loop
      processed++
    } catch {
      failed++ // the renderer persisted the retry and its next due time
    }
  }
  return { processed, failed }
}
