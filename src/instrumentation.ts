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

// TEMP: captures server-side render/action errors to a log file so they can
// be inspected from outside the dev server's stdout. Remove once the
// digest 671018856 crash is resolved.
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { logRequestErrorToFile } = await import('./instrumentation-node')
  await logRequestErrorToFile(err, request, context)
}
