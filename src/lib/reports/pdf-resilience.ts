import 'server-only'

import { reportError } from '@/lib/observability/report-error'
import { generateAndStoreReportPdf } from './pdf'

/** Total attempts (initial + retries) for background PDF generation. */
const MAX_ATTEMPTS = 3

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Generate a report PDF in the background with bounded retry and alerting.
 *
 * generateAndStoreReportPdf() manages pdf_status itself (generating → ready |
 * failed) on every attempt, so a terminal failure already leaves the snapshot
 * in 'failed' (never stuck). This wrapper adds two things the fire-and-forget
 * call sites were missing:
 *
 *  - retry with linear backoff, so a transient flake (browser launch, print
 *    render timeout) doesn't permanently fail the report; and
 *  - an ops alert once all attempts are exhausted, so the failure is visible
 *    instead of vanishing into the logs.
 *
 * Never throws — it is the terminal handler for a background task.
 */
export async function generatePdfWithResilience(snapshotId: string): Promise<void> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await generateAndStoreReportPdf(snapshotId, {})
      return
    } catch (err) {
      lastError = err
      if (attempt < MAX_ATTEMPTS) {
        await sleep(2000 * attempt)
      }
    }
  }

  await reportError(lastError, {
    source: 'reports.pdf',
    severity: 'error',
    alert: true,
    context: { snapshotId, attempts: MAX_ATTEMPTS },
  })
}
