// =============================================================================
// src/lib/reports/custom/index.ts
//
// Registry for hand-coded custom reports.
//
// A custom report is a pair of:
//   - a data builder (server-side, receives ReportContext, returns a typed payload)
//   - a React component (client-side, renders the payload to a printable page)
//
// When a report_templates row has custom_report_slug set, the runner skips
// the block resolution pipeline entirely. Instead it calls the builder, stores
// the payload in report_snapshots.rendered_data as a single 'custom' block,
// and the renderer dispatches to the matching component at render time.
//
// To add a new custom report:
//   1. Create src/lib/reports/custom/<slug>.ts that exports a CustomReport.
//   2. Create the matching component under src/components/reports/custom/.
//   3. Import + register here in CUSTOM_REPORTS.
//   4. Create a report_templates row with custom_report_slug = '<slug>'.
// =============================================================================

import type { ComponentType } from 'react'
import type { ReportContext } from '../report-context'
import type { ReportTheme } from '../presentation'

/**
 * Subset of ReportContext that flows through to the rendering component.
 * Excludes the DB-coupled bits (full taxonomy maps, scores) — those should
 * be baked into the payload by the builder.
 */
export interface CustomReportRenderContext {
  brandTheme: ReportTheme
  participantName: string
  participantFirstName?: string
  participantLastName?: string
  campaignName?: string
  assessmentName?: string
  generatedAt: string
}

export interface CustomReport<TData = unknown> {
  /** Stable identifier — stored verbatim in report_templates.custom_report_slug. */
  slug: string
  /** Human-readable label for the admin UI. */
  label: string
  /** Optional description for the admin UI. */
  description?: string

  /** Build the typed payload from the shared context. Runs server-side. */
  buildData: (ctx: ReportContext) => Promise<TData> | TData

  /** Renders the payload. Receives the payload + a light render context. */
  Component: ComponentType<{ data: TData; ctx: CustomReportRenderContext }>
}

/**
 * The registry. Add entries here as custom reports are implemented.
 *
 * Keys must match the slug field exactly. Use kebab-case slugs prefixed by
 * client identifier when applicable (e.g. 'acme-leadership-2026').
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CUSTOM_REPORTS: Record<string, CustomReport<any>> = {
  // Register custom reports here.
}

export function getCustomReport(slug: string): CustomReport | undefined {
  return CUSTOM_REPORTS[slug]
}

export function listCustomReports(): Array<{ slug: string; label: string; description?: string }> {
  return Object.values(CUSTOM_REPORTS).map((r) => ({
    slug: r.slug,
    label: r.label,
    description: r.description,
  }))
}
