import 'server-only'

/** Fixed, numeric diagnostics for the two public assessment write routes. */
export function createAssessRouteTiming() {
  const startedAt = performance.now()
  const phases: Array<{ name: 'assess_token_rl' | 'assess_rpc'; durationMs: number }> = []
  const duration = (milliseconds: number) => Number.isFinite(milliseconds)
    ? Math.max(0, milliseconds).toFixed(1)
    : '0.0'

  return {
    async measure<T>(name: 'assess_token_rl' | 'assess_rpc', operation: () => PromiseLike<T>): Promise<T> {
      const phaseStartedAt = performance.now()
      try {
        return await operation()
      } finally {
        phases.push({ name, durationMs: performance.now() - phaseStartedAt })
      }
    },
    finish(response: Response): Response {
      // No request headers, token, IDs, messages or descriptions enter this value.
      const value = [
        ...phases.map(({ name, durationMs }) => `${name};dur=${duration(durationMs)}`),
        `assess_handler;dur=${duration(performance.now() - startedAt)}`,
      ].join(', ')
      response.headers.append('Server-Timing', value)
      // Next may retain the proxy's Server-Timing instead of the route header.
      // This distinct header keeps route phases available alongside proxy phases.
      response.headers.set('X-Assess-Timing', value)
      return response
    },
  }
}
