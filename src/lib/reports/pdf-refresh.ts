export type ReportPdfRefreshTarget = {
  snapshotId: string
  sourcePdfUrl: string
}

/**
 * Production-only, one-time PDF artwork refresh targets. The variable is
 * removed after the target files are regenerated, so ordinary PDF jobs never
 * inherit the notification suppression used by this controlled refresh.
 */
export function parseReportPdfRefreshTargets(
  raw = process.env.REPORT_PDF_REFRESH_TARGETS,
): ReportPdfRefreshTarget[] {
  if (!raw) return []

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error('REPORT_PDF_REFRESH_TARGETS must be valid JSON')
  }

  if (!Array.isArray(value)) {
    throw new Error('REPORT_PDF_REFRESH_TARGETS must be a JSON array')
  }

  const targets = value.map((entry) => {
    const target = entry as Partial<ReportPdfRefreshTarget> | null
    if (
      !target ||
      typeof target.snapshotId !== 'string' ||
      !target.snapshotId ||
      typeof target.sourcePdfUrl !== 'string' ||
      !target.sourcePdfUrl.startsWith('reports/')
    ) {
      throw new Error('REPORT_PDF_REFRESH_TARGETS contains an invalid target')
    }

    return {
      snapshotId: target.snapshotId,
      sourcePdfUrl: target.sourcePdfUrl,
    }
  })

  if (new Set(targets.map((target) => target.snapshotId)).size !== targets.length) {
    throw new Error('REPORT_PDF_REFRESH_TARGETS contains duplicate snapshot IDs')
  }

  return targets
}
