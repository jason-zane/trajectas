import type { ReportSnapshotStatus } from '@/types/database'

export function getReportStatusLabel(status: ReportSnapshotStatus | string) {
  if (status === 'pending' || status === 'generating') {
    return 'Generating...'
  }

  if (status === 'ready') {
    return 'Ready'
  }

  if (status === 'released') {
    return 'Sent'
  }

  if (status === 'failed') {
    return 'Failed'
  }

  return status
}

export function getReportStatusVariant(
  status: ReportSnapshotStatus | string
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'pending' || status === 'generating') {
    return 'secondary'
  }

  if (status === 'ready' || status === 'released') {
    return 'default'
  }

  if (status === 'failed') {
    return 'destructive'
  }

  return 'outline'
}

export function isReportGenerating(status: ReportSnapshotStatus | string) {
  return status === 'pending' || status === 'generating'
}

export function isReportViewable(status: ReportSnapshotStatus | string) {
  return status === 'ready' || status === 'released'
}
