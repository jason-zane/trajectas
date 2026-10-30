import { generateSampleData } from '@/lib/reports/sample-data'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'
import type { BlockConfig, ResolvedBlockData } from '@/lib/reports/types'
import type { PreviewEntity } from '@/lib/reports/sample-data'
import type { BandScheme } from '@/lib/reports/band-scheme'
import { getCustomReport } from '@/lib/reports/custom'

export type { PreviewEntity }

export function buildTemplatePreviewBlocks(
  templateBlocks: Record<string, unknown>[] | BlockConfig[],
  entities: PreviewEntity[] = [],
  templateName = 'Assessment Report',
  scheme?: BandScheme,
  customReportSlug?: string,
  presentationConfig?: unknown,
): ResolvedBlockData[] {
  const custom = customReportSlug ? getCustomReport(customReportSlug) : undefined
  if (custom?.buildPreviewData) {
    return [{ blockId: 'custom-preview', type: 'custom', order: 0,
      data: { slug: custom.slug, payload: custom.buildPreviewData(presentationConfig), participantFirstName: 'Alex', participantLastName: 'Morgan' },
      resolvedBrandTheme: DEFAULT_REPORT_THEME }]
  }
  return generateSampleData(
    templateBlocks as Record<string, unknown>[] | BlockConfig[],
    DEFAULT_REPORT_THEME,
    entities,
    templateName,
    scheme,
  )
}
