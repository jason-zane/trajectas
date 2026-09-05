/** Remove bearer credentials before diagnostics leave the request boundary. */
const SECRET_KEY = /^(?:authorization|cookie|set-cookie|password|access[_-]?token|refresh[_-]?token|report[_-]?token|pdf[_-]?token|api[_-]?key|secret|token)$/i

export function redactDiagnosticText(value: string): string {
  return value
    .replace(/(\/assess\/join\/)[^/?#\s]+/gi, '$1[redacted]')
    .replace(/(\/assess\/)(?!join(?:\/|\b))[^/?#\s]+/gi, '$1[redacted]')
    .replace(/([?&](?:access_?token|refresh_?token|reportToken|pdfToken|token|key|secret)=)[^&#\s]*/gi, '$1[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
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
