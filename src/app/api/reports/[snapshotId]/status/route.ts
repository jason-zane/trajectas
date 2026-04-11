import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireReportSnapshotAccess,
} from '@/lib/auth/authorization'
import { getSnapshotPdfState, mapReportPdfStatus } from '@/lib/reports/pdf'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  const { snapshotId } = await params

  try {
    await requireReportSnapshotAccess(snapshotId)
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  try {
    const snapshot = await getSnapshotPdfState(snapshotId)
    if (!snapshot) {
      return Response.json({ error: 'Report not found' }, { status: 404 })
    }

    return Response.json(mapReportPdfStatus(snapshot, snapshotId))
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load report status'
    return Response.json({ error: message }, { status: 500 })
  }
}
