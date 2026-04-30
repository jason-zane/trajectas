/**
 * Pure string utilities for HTML / header-injection escaping.
 *
 * Kept in a dedicated module (no dependency on the `sanitize-html` package)
 * so importing these helpers does not pull the full HTML sanitiser into a
 * Lambda's static module graph. The login Lambda imports this via the email
 * render chain; eagerly loading `sanitize-html` there has caused
 * "Failed to load external module" cold-start failures.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function stripLineBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, " ");
}
