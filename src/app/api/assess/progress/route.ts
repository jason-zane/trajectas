import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Lightweight POST endpoint for navigator.sendBeacon().
 * Called during beforeunload to flush pending progress updates.
 * Uses the same Postgres RPC as updateSessionProgressLite.
 */
export async function POST(request: Request) {
  let body: { token?: string; sessionId?: string; sectionId?: string; itemIndex?: number }
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { token, sessionId, sectionId, itemIndex } = body

  if (!token || !sessionId || !sectionId || itemIndex === undefined) {
    return new Response('Missing required fields', { status: 400 })
  }

  const db = createAdminClient()

  const { data, error } = await db.rpc('update_session_progress_for_session', {
    p_access_token: token,
    p_session_id: sessionId,
    p_current_section_id: sectionId,
    p_current_item_index: itemIndex,
  })

  if (error) {
    return new Response('Internal error', { status: 500 })
  }

  if (data === false) {
    return new Response('Forbidden', { status: 403 })
  }

  return new Response('OK', { status: 200 })
}
