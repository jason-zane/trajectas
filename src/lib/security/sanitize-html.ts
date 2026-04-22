import DOMPurify from "isomorphic-dompurify";

const REPORT_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "code",
  "pre",
  "hr",
  "span",
];

const REPORT_ALLOWED_ATTR = ["href", "target", "rel", "class"];

const SAFE_URI_REGEXP = /^(?:(?:https?|mailto|tel):|\/|#)/i;

/**
 * Sanitise admin-authored rich-text HTML before rendering it as inline HTML
 * in a report / assessment context. The content is authored by partner or
 * client admins and rendered to participants (unauthenticated token holders);
 * without this filter a malicious admin could inject script into another
 * tenant's audience.
 */
export function sanitizeReportHtml(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: REPORT_ALLOWED_TAGS,
    ALLOWED_ATTR: REPORT_ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: SAFE_URI_REGEXP,
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * HTML-escape a plain-text string for safe interpolation into HTML.
 * Use for email variable values and anywhere untrusted text is spliced
 * into rendered HTML without a rich-text editor involved.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Strip CR/LF from a string so it can't inject additional RFC 5322 headers
 * when interpolated into email subject lines, display names, or similar.
 */
export function stripLineBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, " ");
}
