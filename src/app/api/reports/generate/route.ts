import { processSnapshot } from '@/lib/reports/runner'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireAdminScope,
} from '@/lib/auth/authorization'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * POST /api/reports/generate
 *
 * Two call patterns:
 *   { snapshotId } — process one specific snapshot
 *   { sessionId }  — process all pending snapshots for a session
 *   {}             — process the next pending snapshot in queue
 *
 * Client fires this with fetch() and does not await the response for
 * background generation. Admin/retry calls await the response.
 */
export async function POST(request: Request) {
  try {
    await requireAdminScope()
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
    const body = await request.json() as {
      snapshotId?: string
      sessionId?: string
    }

    const db = createAdminClient()

    if (body.snapshotId) {
      // Process one specific snapshot
      await processSnapshot(body.snapshotId)
      return Response.json({ processed: [body.snapshotId] })
    }

    if (body.sessionId) {
      // Process all pending snapshots for a session
      const { data } = await db
        .from('report_snapshots')
        .select('id')
        .eq('participant_session_id', body.sessionId)
        .eq('status', 'pending')
      const ids = (data ?? []).map((r: { id: string }) => r.id)
      await Promise.all(ids.map(processSnapshot))
      return Response.json({ processed: ids })
    }

    // Process the oldest pending snapshot in queue
    const { data: next } = await db
      .from('report_snapshots')
      .select('id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!next) {
      return Response.json({ processed: [], message: 'No pending snapshots' })
    }

    await processSnapshot(next.id)
    return Response.json({ processed: [next.id] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Runner failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
