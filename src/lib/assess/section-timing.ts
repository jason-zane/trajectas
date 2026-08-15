/**
 * Pure deadline maths for server-authoritative section timing (LR-2 / #332).
 *
 * The server (start_section_for_session / save_response_for_session /
 * save_responses_batch_for_session — see
 * supabase/migrations/20260813102000_cognitive_delivery_and_timing.sql) is
 * the ONLY authority on whether a write is in time. Everything in this file
 * is presentation: turning a server-issued deadline into a countdown the
 * participant can read, corrected for the difference between their clock
 * and the server's. None of it is trusted for enforcement — a participant
 * who moves their system clock changes only what they see, never what the
 * save RPCs accept.
 */

/**
 * Milliseconds between the client's Date.now() and the server's clock, at
 * the moment `serverNowIso` was captured. Positive means the client's clock
 * is BEHIND the server's (adding skewMs to a later Date.now() reading
 * corrects it forward).
 */
export function computeSkewMs(serverNowIso: string, clientNowMs: number): number {
  return Date.parse(serverNowIso) - clientNowMs
}

/**
 * Whole seconds remaining until `deadlineAtIso`, corrected for clock skew.
 * Never negative — callers treat 0 as expired.
 */
export function remainingSeconds(
  deadlineAtIso: string,
  skewMs: number,
  nowMs: number,
): number {
  const deadlineMs = Date.parse(deadlineAtIso)
  const correctedNowMs = nowMs + skewMs
  return Math.max(0, Math.ceil((deadlineMs - correctedNowMs) / 1000))
}

/** True once the skew-corrected clock has reached the deadline. */
export function isPastDeadline(
  deadlineAtIso: string,
  skewMs: number,
  nowMs: number,
): boolean {
  return remainingSeconds(deadlineAtIso, skewMs, nowMs) <= 0
}

/**
 * Applies an accommodation multiplier to a base section limit the same way
 * the server does (`ceil(limit * multiplier)` in start_section_for_session).
 * Exported so the arithmetic is pinned by a unit test independent of the
 * database — the RPC itself remains the actual authority, verified
 * separately (see tests/integration/section-timing-rpc.test.ts).
 */
export function applyTimeMultiplier(baseLimitSeconds: number, multiplier: number): number {
  return Math.ceil(baseLimitSeconds * multiplier)
}

/** Formats a whole-second countdown as `mm:ss`, clamped at zero. */
export function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds)
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
