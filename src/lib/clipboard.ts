/**
 * Attempts to write `text` to the system clipboard via the async Clipboard
 * API. Returns `true` if the write succeeded, `false` if either:
 *
 * - `navigator.clipboard` is unavailable (insecure context, locked-down
 *   corporate browser), or
 * - `writeText()` rejected (document not focused, permission denied, etc.)
 *
 * Callers MUST handle the `false` case explicitly. The recommended pattern
 * is to open a fallback dialog with a selectable input so the user can copy
 * the value manually. Do NOT show the value in a toast — toasts can be
 * shoulder-surfed and are not selectable on most platforms.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return false;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
