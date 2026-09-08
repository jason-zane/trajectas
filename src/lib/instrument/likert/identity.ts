import 'server-only'
import { assessItem } from './review'
import { z } from 'zod'
import { createHash } from 'node:crypto'
import { LIKERT_VERSION, reviewItemSchema, type LikertCandidate, type LikertSpec, type ItemQuality } from './contracts'

export function fingerprint(value: unknown): string {
  function canonical(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(canonical)
    if (input && typeof input === 'object') return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]))
    return input
  }
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}
export function itemFingerprint(item: LikertCandidate): string {
  return fingerprint({ id: item.id, stem: item.stem, reverseScored: item.reverseScored, cell: item.blueprintCellId })
}
const qualitySchema = z.object({
  version: z.literal(LIKERT_VERSION), specHash: z.string(), itemHash: z.string(), reviewedAt: z.string(),
  reviews: z.array(reviewItemSchema.extend({ model: z.string().min(3) })).length(3),
  pass: z.boolean(), reasons: z.array(z.string()), score: z.number().finite().min(0).max(4), correctedKey: z.boolean(), readingGrade: z.number().finite(),
})

export function currentQuality(item: LikertCandidate, spec: LikertSpec): ItemQuality | null {
  const quality = item.payload?.likertQuality as ItemQuality | undefined
  if (!quality || quality.version !== LIKERT_VERSION || quality.specHash !== fingerprint(spec) || quality.itemHash !== itemFingerprint(item)) return null
  return qualitySchema.safeParse(quality).success ? quality : null
}
export function passingScores(items: LikertCandidate[], spec: LikertSpec): Map<string, number> {
  return new Map(items.flatMap(item => {
    const quality = currentQuality(item, spec)
    const verified = quality && assessItem(item, spec, quality.reviews.map(review => ({ model: review.model, items: [review] })))
    return quality?.pass && verified?.pass && !verified.correctedKey && item.status !== 'rejected' ? [[item.id, verified.score] as [string, number]] : []
  }))
}
