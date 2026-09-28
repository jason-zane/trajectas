const GATEWAY_MESSAGE = /\b(?:Bad Gateway|Service (?:Temporarily )?Unavailable|Gateway Time-?out)\b/i

/**
 * True when Supabase's gateway, not Postgres, refused the request (HTTP
 * 502/503/504). postgrest-js turns a non-JSON error body into
 * `{ message: body }`, so the gateway's status text is the only signal the
 * caller receives. Such a request never reached the database, or its outcome
 * is unknown, so a durable job that runs again on the next tick loses nothing.
 */
export function isSupabaseGatewayError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' && GATEWAY_MESSAGE.test(message)
}
