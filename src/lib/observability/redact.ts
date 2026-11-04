/** Remove bearer credentials before diagnostics leave the request boundary. */
const SECRET_KEY = /^(?:authorization|cookie|set-cookie|password|access[_-]?token|refresh[_-]?token|report[_-]?token|pdf[_-]?token|pdf[_-]?rate[_-]?limit[_-]?proof|api[_-]?key|secret|token)$/i

export function redactDiagnosticText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(\/assess\/join\/)[^/?#\s]+/gi, '$1[redacted]')
    .replace(/(\/assess\/)(?!join(?:\/|\b))[^/?#\s]+/gi, '$1[redacted]')
    .replace(/([?&](?:access_?token|refresh_?token|reportToken|pdfToken|pdfRateLimitProof|token|key|secret)=)[^&#\s]*/gi, '$1[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
}

/** Central sink allowlist. Arbitrary strings, payloads and nested rows are omitted. */
export function diagnosticContextProjection(value: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!value) return {}
  const result: Record<string, unknown> = {}
  const counts = new Set(['count','swept','failed','attempts','processed','queued','durationMs','retryPersistFailed'])
  const enums: Record<string, readonly string[]> = {
    phase:['query','run','sweep','claim-lost','post-pdf','save','batch','single','generate','upload','notification'],
    request_kind:['save','batch','single'],retryStatus:['pending','retry','failed','completed','generating'],
    method:['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD'],routeType:['render','route','action'],
    renderSource:['react-server-components','react-server-components-payload','server-rendering'],routerKind:['App Router','Pages Router'],
  }
  for (const [key,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!('value' in descriptor)) continue
    const entry: unknown = descriptor.value
    if (counts.has(key) && ((typeof entry==='number'&&Number.isFinite(entry)) || typeof entry==='boolean')) result[key]=entry
    else if (typeof entry==='string' && enums[key]?.includes(entry)) result[key]=entry
    else if (key==='digest'&&typeof entry==='string'&&/^[0-9]{1,20}$/.test(entry)) result[key]=entry
    else if (/^(?:snapshot|session|campaign|participant|assessment|client|request)Id$/.test(key) && typeof entry==='string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(entry)) result[key]=entry
  }
  return result
}

/** Bounded and cycle-safe: an error reporter must not fail on its context. */
export function redactDiagnosticContext(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactDiagnosticText(value)
  if (value === null || typeof value !== 'object') return value
  if (depth >= 8) return '[truncated]'
  if (seen.has(value)) return '[circular]'
  seen.add(value)
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((entry) => redactDiagnosticContext(entry, depth + 1, seen))
  }
  return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, entry]) => [
    key,
    SECRET_KEY.test(key) ? '[redacted]' : redactDiagnosticContext(entry, depth + 1, seen),
  ]))
}
