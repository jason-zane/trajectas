import { generateSampleData } from '@/lib/reports/sample-data'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'
import type { BlockConfig, ResolvedBlockData } from '@/lib/reports/types'

export function buildTemplatePreviewBlocks(
  templateBlocks: Record<string, unknown>[] | BlockConfig[],
): ResolvedBlockData[] {
  return generateSampleData(
    templateBlocks as Record<string, unknown>[] | BlockConfig[],
    DEFAULT_REPORT_THEME,
  )
}
