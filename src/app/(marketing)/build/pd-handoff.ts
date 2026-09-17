/**
 * Hand-off key for the home page's paste box -> /build. The home page never
 * creates anything itself; it stores the pasted text and sends the visitor
 * to /build, which reads and clears it on mount.
 */
export const PD_HANDOFF_KEY = "trajectas:build-pd-handoff";

export function readAndClearPdHandoff(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(PD_HANDOFF_KEY);
    if (value) window.sessionStorage.removeItem(PD_HANDOFF_KEY);
    return value;
  } catch {
    return null;
  }
}
