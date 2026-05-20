import * as Sentry from '@sentry/nextjs'
import type { Instrumentation } from 'next'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  Sentry.captureRequestError(err, request, context)

  // TEMP: also captures server-side render/action errors to a log file so
  // they can be inspected from outside the dev server's stdout. Remove
  // once the digest 671018856 crash is resolved.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { logRequestErrorToFile } = await import('./instrumentation-node')
  await logRequestErrorToFile(err, request, context)
}
