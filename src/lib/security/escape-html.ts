/**
 * Pure string utilities for HTML / header-injection escaping.
 *
 * This module has zero dependencies on purpose. The login Lambda imports it
 * via the email render chain, and eagerly loading any HTML sanitiser there
 * (sanitize-html / isomorphic-dompurify / jsdom) has caused
 * "Failed to load external module" cold-start failures three times now.
 *
 * Do NOT add imports to this file. The constraint is enforced by
 * `tests/architecture/login-bundle-purity.test.ts`.
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
