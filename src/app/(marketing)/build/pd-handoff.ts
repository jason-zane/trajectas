/**
 * Hand-off key for the home page's paste box -> /build. The home page never
 * creates anything itself; it stores the pasted text and sends the visitor
 * to /build. /build reads it on mount but only clears it once the brief is
 * actually submitted: the verify step comes first, and a refresh during
 * verification must not lose the pasted description.
 */
export const PD_HANDOFF_KEY = "trajectas:build-pd-handoff";

export function readPdHandoff(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(PD_HANDOFF_KEY);
  } catch {
    return null;
  }
}

export function clearPdHandoff(): void {
  try {
    window.sessionStorage.removeItem(PD_HANDOFF_KEY);
  } catch {
    // sessionStorage unavailable — nothing was stored to clear.
  }
}
