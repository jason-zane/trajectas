import { createAdminClient } from '@/lib/supabase/admin'
import { logActionError } from '@/lib/security/action-errors'
import { checkAssessApiTokenRateLimit } from '@/lib/security/rate-limit'
import { getAssessSessionProof, verifyAssessSessionProof } from '@/lib/assess/session-proof'
import {
  parseJsonRequestWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'
import { saveResponseLiteInputSchema } from '@/lib/validations/assess'

export const runtime = 'nodejs'

const MAX_SAVE_BODY_BYTES = 16 * 1024

/**
 * POST endpoint for participant response saves. Replaces the saveResponseLite
 * server action so the assessment runner's save queue can fire requests in
 * parallel without contending with the per-route Next.js Server Action mutex.
 *
 * Calls the same save_response_for_session RPC (ownership validation + upsert
 * in a single round-trip), so semantics match the prior server action exactly.
 */
export async function POST(request: Request) {
  let body: {
    token?: string
    sessionId?: string
    itemId?: string
    sectionId?: string
    responseValue?: number
    responseData?: Record<string, unknown>
    responseTimeMs?: number
  }
  try {
    body = await parseJsonRequestWithLimit(request, MAX_SAVE_BODY_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: 'Request body too large' }, { status: 413 })
    }
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = saveResponseLiteInputSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input' }, { status: 400 })
  }

  const input = parsed.data
  const proof = getAssessSessionProof(request)
  if (proof && !verifyAssessSessionProof(proof, { token: input.token, sessionId: input.sessionId })) {
    return Response.json({ error: 'Invalid session proof' }, { status: 403 })
  }

  // Per-token budget on top of the proxy's per-IP rule; keyed on the token
  // actually submitted, so it can't be dodged by forging request headers.
  const rateLimit = await checkAssessApiTokenRateLimit('save', input.token)
  if (rateLimit && !rateLimit.allowed) {
    return Response.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      },
    )
  }

  const db = createAdminClient()

  const { data, error } = await db.rpc('save_response_for_session', {
    p_access_token: input.token,
    p_session_id: input.sessionId,
    p_item_id: input.itemId,
    p_section_id: input.sectionId,
    p_response_value: input.responseValue,
    p_response_data: input.responseData ?? {},
    p_response_time_ms: input.responseTimeMs ?? null,
  })

  if (error) {
    logActionError('apiAssessSave.rpc', error)
    return Response.json({ error: 'Unable to save response' }, { status: 500 })
  }

  if (data === false) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  return Response.json({ success: true }, { status: 200 })
}
