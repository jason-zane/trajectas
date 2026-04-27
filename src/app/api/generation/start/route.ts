import { startGenerationRun } from '@/app/actions/generation'
import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireAdminScope,
} from '@/lib/auth/authorization'
import {
  parseJsonRequestWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'

export const runtime = 'nodejs'
// Allow long-running generation pipelines (up to 5 minutes)
export const maxDuration = 300

const MAX_GENERATION_START_BODY_BYTES = 8 * 1024

/**
 * POST /api/generation/start
 *
 * Kicks off a generation pipeline run. This is an API route (not a server action)
 * so that client-side navigation doesn't abort the long-running pipeline.
 * The client fires this with fetch() and doesn't await the response.
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

  let body: { runId?: string }
  try {
    body = await parseJsonRequestWithLimit(request, MAX_GENERATION_START_BODY_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: 'Request body is too large' }, { status: 413 })
    }

    return Response.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const { runId } = body

  if (!runId) {
    return Response.json({ error: 'runId is required' }, { status: 400 })
  }

  try {
    // Run the pipeline — this may take several minutes
    const result = await startGenerationRun(runId)

    return Response.json(result, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: 'Authentication is required' }, { status: 401 })
    }

    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 403 })
    }

    const message = error instanceof Error ? error.message : 'Failed to start generation run'
    return Response.json({ error: message }, { status: 500 })
  }
}
