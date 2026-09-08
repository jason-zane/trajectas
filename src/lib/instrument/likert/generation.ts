import { z } from 'zod'

export const intentSchema = z.object({
  index: z.number().int().min(0),
  focus: z.string().trim().min(10).max(400),
  condition: z.string().trim().min(4).max(300),
  distinction: z.string().trim().min(10).max(500),
  reverseScored: z.boolean(),
})
export type ItemIntent = z.infer<typeof intentSchema>
export interface GenerationPlan {
  key: string
  specHash: string
  poolHash: string
  model: string
  intents: ItemIntent[]
}

/** Planning is generation input, never item-quality evidence. */
export function parseIntentPlan(raw: string, count: number, reverseCount: number) {
  const result = z.object({ intents: z.array(intentSchema).max(count), coverageBlocker: z.string().trim().min(10).max(1000).nullable() }).parse(JSON.parse(raw))
  if (result.coverageBlocker) {
    if (result.intents.length) throw new Error('A blocked plan must contain no item intents.')
  } else {
    if (result.intents.length !== count || new Set(result.intents.map(intent => intent.index)).size !== count || result.intents.some(intent => intent.index >= count)) throw new Error('Intent plan must contain every requested index exactly once.')
    if (result.intents.filter(intent => intent.reverseScored).length !== reverseCount) throw new Error('Intent plan has incorrect reverse-key count.')
    if (new Set(result.intents.map(intent => intent.focus.toLowerCase().replace(/\W+/g, ' ').trim())).size !== count) throw new Error('Intent plan repeats the same focus.')
  }
  return result
}

export function parsePlannedDrafts(raw: string, intents: ItemIntent[], repairIds: string[]) {
  const result = z.object({ items: z.array(z.object({ intentIndex: z.number().int(), stem: z.string().trim().min(10).max(300), reverseScored: z.boolean(), rationale: z.string().min(5).max(500), replacesId: z.string().nullable() })).length(intents.length) }).parse(JSON.parse(raw))
  if (new Set(result.items.map(item => item.intentIndex)).size !== intents.length || result.items.some(item => !intents.some(intent => intent.index === item.intentIndex))) throw new Error('Writer must realize each planned intent exactly once.')
  if (result.items.some(item => intents.find(intent => intent.index === item.intentIndex)!.reverseScored !== item.reverseScored)) throw new Error('Writer changed a planned scoring direction.')
  if (result.items.some(item => item.replacesId && !repairIds.includes(item.replacesId))) throw new Error('Unknown repair source.')
  return result
}
