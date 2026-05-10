import { appendFile } from 'node:fs/promises'
import type { Instrumentation } from 'next'

export const logRequestErrorToFile: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
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
    await appendFile('/tmp/trajectas-errors.log', `${entry}\n`)
  } catch {
    // Logging is best-effort.
  }
}
