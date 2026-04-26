import sanitizeHtml from "sanitize-html";

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

const REPORT_ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "target", "rel", "class"],
  span: ["class"],
  p: ["class"],
  h1: ["class"],
  h2: ["class"],
  h3: ["class"],
  h4: ["class"],
  h5: ["class"],
  h6: ["class"],
  ul: ["class"],
  ol: ["class"],
  li: ["class"],
  blockquote: ["class"],
  code: ["class"],
  pre: ["class"],
};

/**
 * Sanitise admin-authored rich-text HTML before rendering it as inline HTML
 * in a report / assessment context. The content is authored by partner or
 * client admins and rendered to participants (unauthenticated token holders);
 * without this filter a malicious admin could inject script into another
 * tenant's audience.
 */
export function sanitizeReportHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: REPORT_ALLOWED_TAGS,
    allowedAttributes: REPORT_ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      a: ["http", "https", "mailto", "tel"],
    },
    allowedSchemesAppliedToAttributes: ["href"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const isExternal = /^https?:\/\//i.test(href);
        return {
          tagName: "a",
          attribs: {
            ...attribs,
            ...(isExternal
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {}),
          },
        };
      },
    },
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
