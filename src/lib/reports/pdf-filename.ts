import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Single source of truth for naming generated report PDFs.
 *
 * Every PDF that leaves the system — downloaded from the website, attached to a
 * candidate's report email, or attached to a consultant notification — is named
 * with the same convention:
 *
 *   "<Assessment title> - <Candidate full name> - <Month Year>.pdf"
 *   e.g. "Leadership Potential Inventory - John Smith - April 2026.pdf"
 *
 * The date is when the report was finished (released, else generated, else
 * created) formatted as month + year in UTC. Keep this the only place that
 * decides a report PDF's filename so the convention can't drift between the
 * download path and the email paths.
 */

const MAX_FILENAME_BASE_LENGTH = 180

/** PostgREST embeds come back as an object or a single-element array. */
function pickEmbedded<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) return value[0]
  return value ?? undefined
}

/** Strip characters that are illegal or awkward in a filename, keep it readable. */
export function sanitizeReportFilename(name: string): string {
  // Drop control characters by code point (avoids a control-char regex literal).
  const withoutControls = Array.from(name)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0
      return code >= 0x20 && code !== 0x7f
    })
    .join('')

  return withoutControls
    .replace(/[/\\:*?"<>|]+/g, ' ') // illegal on Windows / macOS / quoting
    .replace(/\s+/g, ' ') // collapse runs of whitespace
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '') // no leading/trailing dots or spaces
    .slice(0, MAX_FILENAME_BASE_LENGTH)
    .trim()
}

/** Format an ISO timestamp as "April 2026" (UTC, deterministic). Empty if unparseable. */
export function formatReportMonthYear(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

/**
 * Build a report PDF filename from its parts. Pure and side-effect free so it
 * can be unit-tested and reused. Falls back gracefully when data is missing.
 */
export function buildReportPdfFilename(parts: {
  assessmentTitle?: string | null
  firstName?: string | null
  lastName?: string | null
  /** ISO timestamp the report was finished. */
  date?: string | null
  /** Stable id used only if there's nothing else to name the file by. */
  fallbackId?: string
}): string {
  const assessment = sanitizeReportFilename(parts.assessmentTitle ?? '')
  const fullName = sanitizeReportFilename(
    [parts.firstName, parts.lastName].filter(Boolean).join(' '),
  )
  const monthYear = formatReportMonthYear(parts.date)

  // Nothing useful to build from — keep the old unique, stable fallback.
  if (!assessment && !fullName && !monthYear) {
    return parts.fallbackId ? `report-${parts.fallbackId}.pdf` : 'report.pdf'
  }

  // "<Assessment> - <Full name> - <Month Year>"
  const composed = sanitizeReportFilename(
    [assessment || 'Report', fullName, monthYear].filter(Boolean).join(' - '),
  )

  return `${composed}.pdf`
}

/**
 * Resolve the canonical filename for a report snapshot's PDF by looking up the
 * assessment, candidate, and finished-at date. Used by the download endpoint
 * and by email attachment builders alike.
 */
export async function getReportPdfFilename(snapshotId: string): Promise<string> {
  const db = createAdminClient()
  const { data } = await db
    .from('report_snapshots')
    .select(
      `
      id,
      released_at,
      generated_at,
      created_at,
      participant_sessions!inner(
        campaign_participants(first_name, last_name),
        assessments(title)
      )
    `,
    )
    .eq('id', snapshotId)
    .maybeSingle()

  if (!data) return `report-${snapshotId}.pdf`

  const session = pickEmbedded(data.participant_sessions)
  const participant = pickEmbedded(session?.campaign_participants) as
    | { first_name: string | null; last_name: string | null }
    | undefined
  const assessment = pickEmbedded(session?.assessments) as
    | { title: string | null }
    | undefined

  const date =
    (data.released_at as string | null) ??
    (data.generated_at as string | null) ??
    (data.created_at as string | null)

  return buildReportPdfFilename({
    assessmentTitle: assessment?.title,
    firstName: participant?.first_name,
    lastName: participant?.last_name,
    date,
    fallbackId: snapshotId,
  })
}

/**
 * Build a `Content-Disposition` value for a PDF download. Provides an ASCII
 * fallback plus an RFC 5987 `filename*` so non-ASCII candidate names (accents,
 * etc.) survive in modern browsers.
 */
export function contentDispositionAttachment(filename: string): string {
  const asciiFallback =
    filename
      .normalize('NFKD')
      .replace(/[^\x20-\x7e]/g, '') // drop non-ASCII
      .replace(/["\\]/g, '') // keep the quoted value well-formed
      .trim() || 'report.pdf'
  const encoded = encodeURIComponent(filename)
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`
}
