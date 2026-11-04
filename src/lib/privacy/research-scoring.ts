import { z } from 'zod'
import { deriveItemBounds } from '@/lib/scoring/item-bounds'
import { postgresUuid } from '@/lib/validations/uuid'

export const frozenResearchScoringSchema = z.object({
  version: z.literal('research-scoring@1'),
  constructId: postgresUuid(),
  reverseScored: z.boolean(),
  minValue: z.number().finite(),
  maxValue: z.number().finite(),
  formatType: z.enum(['likert','binary']),
}).strict().refine(value => value.maxValue > value.minValue)
export type FrozenResearchScoring = z.infer<typeof frozenResearchScoringSchema>

/** Capture non-identifying scoring metadata without altering delivered items. */
export function captureResearchScoring(item: {
  construct_id: string | null
  reverse_scored: boolean | null
  response_formats?: { type: string; config: Record<string, unknown> } | Array<{ type: string; config: Record<string, unknown> }> | null
  item_options?: Array<{ value: number; score_value: number | null; exclude_from_scoring: boolean }> | null
}): FrozenResearchScoring | undefined {
  const format = Array.isArray(item.response_formats) ? item.response_formats[0] : item.response_formats
  if (!item.construct_id || !format || !['likert','binary'].includes(format.type)) return undefined
  const options = item.item_options ?? []
  // Expert-keyed and excluded options need a different calibration pipeline.
  if (options.some(option => option.exclude_from_scoring || (option.score_value != null && Number(option.score_value)!==Number(option.value)))) return undefined
  const bounds = deriveItemBounds(format.config ?? {}, options.map(option => Number(option.value)).filter(Number.isFinite), format.type)
  const parsed = frozenResearchScoringSchema.safeParse({ version: 'research-scoring@1', constructId: item.construct_id,
    reverseScored: Boolean(item.reverse_scored), ...bounds, formatType: format.type })
  return parsed.success ? parsed.data : undefined
}
