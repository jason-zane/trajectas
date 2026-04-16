import { generateSampleData } from '@/lib/reports/sample-data'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'
import type { BlockConfig, ResolvedBlockData } from '@/lib/reports/types'
import type { PreviewEntity } from '@/lib/reports/sample-data'
import type { BandScheme } from '@/lib/reports/band-scheme'

export type { PreviewEntity }

export function buildTemplatePreviewBlocks(
  templateBlocks: Record<string, unknown>[] | BlockConfig[],
  entities: PreviewEntity[] = [],
  templateName = 'Assessment Report',
  scheme?: BandScheme,
): ResolvedBlockData[] {
  return generateSampleData(
    templateBlocks as Record<string, unknown>[] | BlockConfig[],
    DEFAULT_REPORT_THEME,
    entities,
    templateName,
    scheme,
  )
}
