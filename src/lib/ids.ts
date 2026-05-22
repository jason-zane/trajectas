/**
 * Generates a non-cryptographic random ID for UI use (React keys, message
 * IDs, draft IDs, optimistic-update IDs). NOT suitable for security tokens,
 * session IDs, invite codes, or anything that must be unguessable — use
 * `crypto.randomUUID()` directly in those cases and ensure you are in a
 * secure context.
 *
 * The fallback (`Date.now() + Math.random()`) is uniqueness-sufficient for
 * intra-session UI state but is NOT cryptographically random.
 */
export function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
