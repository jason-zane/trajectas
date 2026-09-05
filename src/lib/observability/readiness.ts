import 'server-only'
import { Redis } from '@upstash/redis'
import { createAdminClient } from '@/lib/supabase/admin'

type Check = 'ok' | 'error'

/** Read-only, bounded probes. Never return tenant data or infrastructure secrets. */
export async function getReadinessChecks(): Promise<Record<string, Check>> {
  const checks: Record<string, Check> = {}
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  await Promise.all([
    (async () => {
      try {
        const db = createAdminClient()
        const { error } = await db.from('response_formats').select('id').limit(1)
          .abortSignal(AbortSignal.timeout(3000))
        checks.database = error ? 'error' : 'ok'
      } catch { checks.database = 'error' }
    })(),
    (async () => {
      try {
        if (!url || !token) { checks.rateLimit = 'error'; return }
        const redis = new Redis({ url, token, retry: false, signal: () => AbortSignal.timeout(3000) })
        checks.rateLimit = await redis.ping() === 'PONG' ? 'ok' : 'error'
      } catch { checks.rateLimit = 'error' }
    })(),
    (async () => {
      try {
        const db = createAdminClient()
        const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
        // A small indexed existence query, not a full queue count. Fifteen
        // minutes spans three cron opportunities and the abandoned-job lease.
        const results = await Promise.all([
          db.from('report_snapshots').select('id').eq('status', 'pending').lt('created_at', cutoff).limit(1).abortSignal(AbortSignal.timeout(3000)),
          db.from('report_snapshots').select('id').eq('status', 'generating').lt('updated_at', cutoff).limit(1).abortSignal(AbortSignal.timeout(3000)),
          db.from('report_snapshots').select('id').eq('pdf_status', 'queued').lt('updated_at', cutoff).limit(1).abortSignal(AbortSignal.timeout(3000)),
          db.from('report_snapshots').select('id').eq('pdf_status', 'generating').lt('pdf_started_at', cutoff).limit(1).abortSignal(AbortSignal.timeout(3000)),
        ])
        checks.reports = results.some(r => r.error || (r.data?.length ?? 0) > 0) ? 'error' : 'ok'
      } catch { checks.reports = 'error' }
    })(),
  ])
  checks.email = process.env.RESEND_API_KEY ? 'ok' : 'error'
  checks.cron = process.env.CRON_SECRET ? 'ok' : 'error'
  return checks
}
