/**
 * Content Security Policy violation sink. Browsers POST here when a resource
 * is blocked by CSP. Kept deliberately cheap — we log and return 204 so a
 * flood of violations can't become a DoS vector.
 */

import {
  readRequestTextWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'

const MAX_BODY_BYTES = 8 * 1024

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const raw = await readRequestTextWithLimit(request, MAX_BODY_BYTES)

    // Browsers send either `application/csp-report` (classic report-uri) or
    // `application/reports+json` (Reporting API). Accept both — just log it.
    const parsed = JSON.parse(raw) as unknown
    const report = extractReport(parsed)

    if (report) {
      console.warn("[csp-violation]", {
        blockedUri: report["blocked-uri"] ?? report.blockedURL,
        violatedDirective:
          report["violated-directive"] ?? report.effectiveDirective,
        documentUri: report["document-uri"] ?? report.documentURL,
        sourceFile: report["source-file"] ?? report.sourceFile,
        lineNumber: report["line-number"] ?? report.lineNumber,
      })
    }
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return new Response(null, { status: 413 })
    }

    // Malformed report — ignore. A broken browser payload shouldn't 500.
  }

  return new Response(null, { status: 204 })
}

interface CspViolationFields {
  "blocked-uri"?: string
  blockedURL?: string
  "violated-directive"?: string
  effectiveDirective?: string
  "document-uri"?: string
  documentURL?: string
  "source-file"?: string
  sourceFile?: string
  "line-number"?: number
  lineNumber?: number
}

function extractReport(payload: unknown): CspViolationFields | null {
  if (!payload || typeof payload !== "object") return null

  if ("csp-report" in payload) {
    return (payload as { "csp-report": CspViolationFields })["csp-report"]
  }

  if (Array.isArray(payload)) {
    const first = payload[0]
    if (first && typeof first === "object" && "body" in first) {
      return (first as { body: CspViolationFields }).body
    }
  }

  return payload as CspViolationFields
}
