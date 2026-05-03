/**
 * Heavy HTML sanitiser for admin-authored rich text rendered to participants.
 *
 * IMPORTANT: this module must NOT be reachable from the login Lambda's static
 * import graph. Past versions wrapped DOMPurify/jsdom and crashed login at
 * cold start (see commits 68ffe8e, 772eec5, ab6a145, ea1bbeb).
 *
 * Pure escape helpers live in `./escape-html` precisely so callers in the
 * login chain (e.g. `src/lib/email/render.ts`) can import them without
 * pulling this file. The architectural guard is
 * `tests/architecture/login-bundle-purity.test.ts` — if you add a new caller,
 * make sure it is not on a route that login depends on, or the test will fail.
 */
import sanitizeHtml from "sanitize-html";

export { escapeHtml, stripLineBreaks } from "@/lib/security/escape-html";

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

