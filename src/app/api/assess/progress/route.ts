import { createAdminClient } from '@/lib/supabase/admin'
import { checkAssessApiTokenRateLimit } from '@/lib/security/rate-limit'
import { getAssessSessionProof, verifyAssessSessionProof } from '@/lib/assess/session-proof'
import { createAssessRouteTiming } from '@/lib/assess/route-timing'
import { logActionError } from '@/lib/security/action-errors'
import {
  parseJsonRequestWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'

export const runtime = 'nodejs'

const MAX_PROGRESS_BODY_BYTES = 8 * 1024

/**
 * Lightweight POST endpoint for navigator.sendBeacon().
 * Called during beforeunload to flush pending progress updates.
 * Uses the same Postgres RPC as updateSessionProgressLite.
 */
export async function POST(request: Request) {
  const timing = createAssessRouteTiming()
  return timing.finish(await handlePost(request, timing))
}

async function handlePost(request: Request, timing: ReturnType<typeof createAssessRouteTiming>) {
  let body: { token?: string; sessionId?: string; sectionId?: string; itemIndex?: number }
  try {
    body = await parseJsonRequestWithLimit(request, MAX_PROGRESS_BODY_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return new Response('Request body too large', { status: 413 })
    }

    return new Response('Invalid JSON', { status: 400 })
  }

  const { token, sessionId, sectionId, itemIndex } = body

  if (!token || !sessionId || !sectionId || itemIndex === undefined) {
    return new Response('Missing required fields', { status: 400 })
  }
  const proof = getAssessSessionProof(request)
  if (proof && !verifyAssessSessionProof(proof, { token, sessionId })) {
    return new Response('Invalid session proof', { status: 403 })
  }

  // Per-token budget on top of the proxy's per-IP rule; keyed on the token
  // actually submitted, so it can't be dodged by forging request headers.
  const rateLimit = await timing.measure('assess_token_rl', () =>
    checkAssessApiTokenRateLimit('progress', token))
  if (rateLimit && !rateLimit.allowed) {
    return new Response('Too many requests', {
      status: 429,
      headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
    })
  }

  const db = createAdminClient()

  const { data, error } = await timing.measure('assess_rpc', () => db.rpc('update_session_progress_for_session', {
    p_access_token: token,
    p_session_id: sessionId,
    p_current_section_id: sectionId,
    p_current_item_index: itemIndex,
  })).catch((error: unknown) => ({ data: null, error }))

  if (error) {
    logActionError('apiAssessProgress.rpc', error)
    return new Response('Internal error', { status: 500 })
  }

  if (data === false) {
    return new Response('Forbidden', { status: 403 })
  }

  return new Response('OK', { status: 200 })
}
