import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireAdminScope,
} from '@/lib/auth/authorization'
import type { ConstructDraftInput, ConstructChange } from '@/types/generation'

export const runtime = 'nodejs'
// Readiness check makes sequential LLM calls per pair — can take 2-3 minutes
export const maxDuration = 300

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

  const body = (await request.json()) as {
    constructs: ConstructDraftInput[]
    changes?: ConstructChange[]
  }

  if (!Array.isArray(body.constructs) || body.constructs.length === 0) {
    return Response.json({ error: 'constructs array is required' }, { status: 400 })
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
