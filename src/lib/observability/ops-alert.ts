import 'server-only'

import { createHash } from 'node:crypto'
import { Redis } from '@upstash/redis'

import { sendHtmlEmail } from '@/lib/email/provider'

/**
 * Email an operational alert to the address in OPS_ALERT_EMAIL.
 *
 * - No-op if OPS_ALERT_EMAIL (or the Resend key) is unset, so dev/CI/preview
 *   environments stay quiet and nothing breaks without configuration.
 * - Throttled per fingerprint (default 15 min) so a recurring failure doesn't
 *   flood the inbox. Redis coordinates across serverless instances; local
 *   throttling is used only when Redis is not configured. If configured Redis
 *   is unavailable, retain the structured error log and skip the email.
 * - Never throws: a failure to alert must not break the calling path.
 */
const ALERT_THROTTLE_MS = 15 * 60 * 1000
const recentAlerts = new Map<string, number>()

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export async function sendOpsAlert(input: {
  subject: string
  body: string
  /** Grouping key for throttling; defaults to the subject. */
  fingerprint?: string
}): Promise<boolean> {
  const to = process.env.OPS_ALERT_EMAIL
  if (!to || !process.env.RESEND_API_KEY) return false

  const key = input.fingerprint ?? input.subject
  const now = Date.now()
  const last = recentAlerts.get(key)
  if (last !== undefined && now - last < ALERT_THROTTLE_MS) return false
  // Reserve locally before awaiting so simultaneous failures share the throttle.
  recentAlerts.set(key, now)
  if (recentAlerts.size > 2048) {
    for (const [fingerprint, timestamp] of recentAlerts) {
      if (now - timestamp >= ALERT_THROTTLE_MS) recentAlerts.delete(fingerprint)
    }
    if (recentAlerts.size > 2048) recentAlerts.delete(recentAlerts.keys().next().value!)
  }

  try {
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
    if (url || token) {
      if (!url || !token) {
        console.error('[ops-alert] incomplete Redis configuration; email suppressed')
        return false
      }
      const redis = new Redis({ url, token, retry: false, signal: () => AbortSignal.timeout(2000) })
      // Store a digest only: errors and recipient addresses never enter Redis.
      const digest = createHash('sha256').update(`${to}\n${key}`).digest('hex')
      const claimed = await redis.set(`trajectas:ops-alert:${digest}`, '1', {
        nx: true, px: ALERT_THROTTLE_MS,
      })
      if (claimed !== 'OK') return false
    }

    const result = await sendHtmlEmail({
      to,
      subject: `[Trajectas alert] ${input.subject}`,
      html: `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${escapeHtml(input.body)}</pre>`,
      text: input.body,
    })
    // Resend resolves with { data, error } rather than rejecting on API errors.
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      console.error('[ops-alert] Resend returned an error', result.error)
      return false
    }
    return true
  } catch (err) {
    // Best-effort: alerting failures must not propagate.
    console.error('[ops-alert] unable to claim or send alert; structured error remains in logs',
      err instanceof Error ? err.name : 'UnknownError')
    return false
  }
}
