import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireAdminScope,
} from '@/lib/auth/authorization'
import {
  parseJsonRequestWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'
import type { ConstructDraftInput, ConstructChange } from '@/types/generation'

export const runtime = 'nodejs'
// Readiness check makes sequential LLM calls per pair — can take 2-3 minutes
export const maxDuration = 300

const MAX_READINESS_BODY_BYTES = 128 * 1024
const MAX_READINESS_CONSTRUCTS = 100
const MAX_READINESS_CHANGES = 250

/**
 * POST /api/generation/readiness
 *
 * Runs the construct readiness pre-flight check. This is an API route
 * (not a server action) so that long-running LLM calls aren't killed
 * by dev-mode HMR or server action timeouts.
 */
export async function POST(request: Request) {
  try {
    await requireAdminScope()
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: 'Authentication is required' }, { status: 401 })
    }
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  let body: {
    constructs?: ConstructDraftInput[]
    changes?: ConstructChange[]
  }

  try {
    body = await parseJsonRequestWithLimit(request, MAX_READINESS_BODY_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: 'Request body is too large' }, { status: 413 })
    }
    return Response.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  if (!Array.isArray(body.constructs) || body.constructs.length === 0) {
    return Response.json({ error: 'constructs array is required' }, { status: 400 })
  }

  if (body.constructs.length > MAX_READINESS_CONSTRUCTS) {
    return Response.json({ error: 'constructs array is too large' }, { status: 400 })
  }

  if (body.changes && body.changes.length > MAX_READINESS_CHANGES) {
    return Response.json({ error: 'changes array is too large' }, { status: 400 })
  }

  try {
    const { runConstructPreflight } = await import('@/lib/ai/generation')
    const result = await runConstructPreflight(body.constructs, body.changes)
    return Response.json({ success: true, result })
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
