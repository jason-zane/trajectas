import type { Instrumentation } from 'next'
import { assertSurfaceUrlsConfigured } from '@/lib/hosts'

/**
 * Boot-time hook. Throws if required surface URL env vars are missing in
 * production so misconfigured deploys fail loudly at boot rather than
 * silently emitting auth redirects pointing at localhost or shorting the
 * Server Action allowed-origins list.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    assertSurfaceUrlsConfigured()
  }
}

/**
 * Routes unhandled server errors (render-time, action, and API route errors)
 * to the error_events table for persistence and observability.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { reportRequestError } = await import('./instrumentation-node')
  await reportRequestError(err, request, context)
}
