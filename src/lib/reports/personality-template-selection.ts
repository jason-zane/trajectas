import 'server-only'
import { IPIP_ID } from '@/lib/instrument/ipip-neo-120/definition'

/** A campaign may carry competency and personality assessments together.
 * Only an explicitly registered compatible custom report can consume IPIP.
 */
export function selectIpipReportTemplateIds(
  templates: readonly { id: string; custom_report_slug?: string | null }[],
  reports: Readonly<Record<string, { supportedInstrumentIds?: readonly string[] }>>,
): string[] {
  return templates.filter(template => {
    const slug = template.custom_report_slug
    return Boolean(slug && reports[slug]?.supportedInstrumentIds?.includes(IPIP_ID))
  }).map(template => template.id)
}
