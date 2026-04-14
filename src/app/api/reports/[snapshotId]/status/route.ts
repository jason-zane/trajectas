import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireReportSnapshotAccess,
} from '@/lib/auth/authorization'
import { getSnapshotPdfState, mapReportPdfStatus } from '@/lib/reports/pdf'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyReportAccessToken } from '@/lib/reports/report-access-token'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  const { snapshotId } = await params
  const url = new URL(request.url)
  const reportToken = url.searchParams.get('reportToken')

  if (reportToken) {
    const tokenPayload = verifyReportAccessToken(reportToken, snapshotId)
    if (!tokenPayload) {
      return Response.json({ error: 'Invalid report token' }, { status: 403 })
    }

    const db = createAdminClient()
    const { data: validSnapshot } = await db
      .from('report_snapshots')
      .select('id, participant_sessions!inner(campaign_participant_id)')
      .eq('id', snapshotId)
      .eq('status', 'released')
      .maybeSingle()

    const session = Array.isArray(validSnapshot?.participant_sessions)
      ? validSnapshot.participant_sessions[0]
      : (validSnapshot?.participant_sessions as
          | { campaign_participant_id: string | null }
          | null
          | undefined)

    if (
      !validSnapshot ||
      !session?.campaign_participant_id ||
      String(session.campaign_participant_id) !== tokenPayload.participantId
    ) {
      return Response.json({ error: 'Report not available' }, { status: 403 })
    }
  } else {
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
