import 'server-only'

import { sendHtmlEmail } from '@/lib/email/provider'

/**
 * Email an operational alert to the address in OPS_ALERT_EMAIL.
 *
 * - No-op if OPS_ALERT_EMAIL (or the Resend key) is unset, so dev/CI/preview
 *   environments stay quiet and nothing breaks without configuration.
 * - Throttled per fingerprint (default 15 min) so a recurring failure doesn't
 *   flood the inbox. The throttle is per-process/in-memory — good enough for a
 *   single failure not to spam; not a guarantee across serverless instances.
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
  recentAlerts.set(key, now)

  try {
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
    console.error('[ops-alert] failed to send alert email', err)
    return false
  }
}
