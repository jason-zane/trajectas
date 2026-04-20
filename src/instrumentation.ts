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
  const { appendFile } = await import('node:fs/promises')
  const error = err as Error & { digest?: string }
  const entry = [
    `\n===== ${new Date().toISOString()} =====`,
    `digest: ${error.digest ?? '(none)'}`,
    `path: ${request.path}`,
    `method: ${request.method}`,
    `routePath: ${context.routePath}`,
    `routeType: ${context.routeType}`,
    `renderSource: ${context.renderSource ?? '(n/a)'}`,
    `message: ${error.message}`,
    `stack: ${error.stack ?? '(no stack)'}`,
  ].join('\n')
  try {
    await appendFile('/tmp/trajectas-errors.log', entry + '\n')
  } catch {
    // swallow — logging is best-effort
  }
}
