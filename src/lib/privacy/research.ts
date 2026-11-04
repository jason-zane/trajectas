import 'server-only'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'
import { frozenResearchScoringSchema } from './research-scoring'
import { toPomp } from '@/lib/scoring/transforms'

const entrySchema = z.object({
  itemId: postgresUuid(), itemVersion: z.number().int(),
  countsTowardScore: z.boolean(), purpose: z.string(),
  researchScoring: frozenResearchScoringSchema.optional(),
})
export type ResearchInputResponse = { item_id: string; response_value: number }
export class ResearchEligibilityError extends Error {}
export function buildRestrictedResearchCase(entries: unknown[], responses: ResearchInputResponse[]) {
  const scored = entries.map(entry => entrySchema.parse(entry)).filter(entry => entry.countsTowardScore && entry.purpose === 'construct')
  if (!scored.length || scored.some(entry => !entry.researchScoring)) throw new ResearchEligibilityError('Historical scoring metadata needs independent review before research extraction.')
  if (new Set(scored.map(entry => entry.itemId)).size !== scored.length) throw new ResearchEligibilityError('Research form contains duplicate items.')
  const byItem = new Map(responses.map(row => [row.item_id, Number(row.response_value)]))
  const inputs = scored.map(entry => {
    const scoring = entry.researchScoring!, value = byItem.get(entry.itemId)
    if (value === undefined || !Number.isFinite(value) || value < scoring.minValue || value > scoring.maxValue) throw new ResearchEligibilityError('Complete in-range responses are required.')
    return { itemId: entry.itemId, itemVersion: entry.itemVersion, value, scoring }
  }).sort((a,b) => a.itemId.localeCompare(b.itemId))
  const groups = new Map<string,number[]>()
  for (const input of inputs) {
    const { constructId, minValue, maxValue, reverseScored } = input.scoring
    const pomp = toPomp(reverseScored ? minValue + maxValue - input.value : input.value,minValue,maxValue)
    const group = groups.get(constructId) ?? []; group.push(pomp); groups.set(constructId,group)
  }
  const scores = [...groups].map(([constructId,values]) => ({ constructId, pomp: values.reduce((sum,value)=>sum+value,0)/values.length }))
  const signature = inputs.map(({ itemId,itemVersion,scoring }) => ({ itemId,itemVersion,scoring }))
  return { formFingerprint: createHash('sha256').update(JSON.stringify(signature)).digest('hex'),
    scoringVersion: 'research-construct-pomp@1', responses: inputs, scores }
}
