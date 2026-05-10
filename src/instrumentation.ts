import type { Instrumentation } from 'next'

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
