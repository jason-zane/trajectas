import { after } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { processSnapshot } from '@/lib/reports/runner'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireAdminScope,
} from '@/lib/auth/authorization'
import {
  parseOptionalJsonRequestWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'

export const runtime = 'nodejs'
export const maxDuration = 300

const MAX_REPORT_GENERATE_BODY_BYTES = 32 * 1024

function isValidInternalKey(provided: string | null): boolean {
  const expected = process.env.INTERNAL_API_KEY
  if (!expected || !provided) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  return a.length === b.length && timingSafeEqual(a, b)
}

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
  // Allow internal server-to-server calls (e.g. from submitSession in participant context)
  const isInternal = isValidInternalKey(request.headers.get('x-internal-key'))

  if (!isInternal) {
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
  }

  try {
    const body = await parseOptionalJsonRequestWithLimit<{
      snapshotId?: string
      sessionId?: string
    }>(request, MAX_REPORT_GENERATE_BODY_BYTES, {})

    const db = createAdminClient()

    if (body.snapshotId) {
      after(async () => {
        try {
          await processSnapshot(body.snapshotId!)
        } catch (error) {
          console.error('[reports] Failed to process snapshot:', error)
        }
      })
      return Response.json({ queued: [body.snapshotId] }, { status: 202 })
    }

    if (body.sessionId) {
      const { data } = await db
        .from('report_snapshots')
        .select('id')
        .eq('participant_session_id', body.sessionId)
        .eq('status', 'pending')
      const ids = (data ?? []).map((r: { id: string }) => r.id)
      after(async () => {
        await Promise.all(
          ids.map(async (id) => {
            try {
              await processSnapshot(id)
            } catch (error) {
              console.error(`[reports] Failed to process snapshot ${id}:`, error)
            }
          }),
        )
      })
      return Response.json({ queued: ids }, { status: 202 })
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
      return Response.json({ queued: [], message: 'No pending snapshots' })
    }

    after(async () => {
      try {
        await processSnapshot(next.id)
      } catch (error) {
        console.error(`[reports] Failed to process snapshot ${next.id}:`, error)
      }
    })
    return Response.json({ queued: [next.id] }, { status: 202 })
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: 'Request body too large' }, { status: 413 })
    }

    if (error instanceof SyntaxError) {
      return Response.json({ error: 'Request body must be valid JSON' }, { status: 400 })
    }

    const message = error instanceof Error ? error.message : 'Runner failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
