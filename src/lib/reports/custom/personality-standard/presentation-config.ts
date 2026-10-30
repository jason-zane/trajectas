import { z } from 'zod'
import defaults from './presentation.json'
const text = z.string().trim().min(1)
export const personalityPresentationSchema = z.object({
  version: z.literal(1).default(1),
  coverHeadline: text.max(100).optional(),
  scales: z.record(z.string().regex(/^[OCEAN]([1-6])?$/), z.object({
    name: text.max(80).optional(), definition: text.max(500).optional(),
    lower: text.max(500).optional(), higher: text.max(500).optional(),
    lowAnchor: text.max(80).optional(), highAnchor: text.max(80).optional(),
  }).strict()).default({}),
}).strict()
export type PersonalityPresentationConfig = z.infer<typeof personalityPresentationSchema>
export function parsePersonalityPresentation(input: unknown): PersonalityPresentationConfig {
  return personalityPresentationSchema.parse(input ?? {})
}
export function personalityPresentation(input?: unknown) {
  const config = parsePersonalityPresentation(input)
  return defaults.map(d => ({ ...d, ...config.scales[d.code],
    facets: d.facets.map(f => ({ ...f, ...config.scales[f.code] })),
  }))
}
export const DEFAULT_PERSONALITY_HEADLINE = 'Personality,\nin perspective.'
