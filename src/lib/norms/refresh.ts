import { z } from 'zod'

const scaleCodes = ['N', 'E', 'O', 'A', 'C'].flatMap(d => [d, ...[1, 2, 3, 4, 5, 6].map(n => d + n)])
const mass = z.array(z.number().finite().nonnegative()).max(97)

/** An aggregate distribution, never respondent rows. Strip unrelated input
 * fields so source records cannot be accidentally retained in the catalogue. */
export const referenceDistribution = z.object({
  id: z.string().min(1).max(150),
  label: z.string().min(1).max(200),
  rawN: z.number().int().positive(),
  kishEffectiveN: z.number().finite().positive(),
  ageBoundsInclusive: z.tuple([z.number().int().min(10).max(99), z.number().int().min(10).max(99)]),
  countryLabels: z.array(z.string().min(1).max(80)).min(1).max(250).nullable(),
  weighting: z.enum(['pooled', 'equal-country', 'us-management-age', 'equal-country-and-us-management-age']),
  nativeScoreMass: z.record(z.string(), mass),
}).superRefine((group, ctx) => {
  if (group.kishEffectiveN > group.rawN + 0.000001 || group.ageBoundsInclusive[0] > group.ageBoundsInclusive[1]) ctx.addIssue({ code: 'custom', message: 'Invalid effective sample size or age range' })
  if (Object.keys(group.nativeScoreMass).length !== 35 || scaleCodes.some(code => {
    const bins = group.nativeScoreMass[code]
    return !bins || bins.length !== (code.length === 1 ? 97 : 17) || Math.abs(bins.reduce((sum, value) => sum + value, 0) - 1) > 1e-9
  })) ctx.addIssue({ code: 'custom', message: 'Provide all 35 native score distributions with unit probability mass' })
})

export function parseReferenceRefresh(text: string) {
  if (new TextEncoder().encode(text).length > 200_000) throw new Error('Upload one aggregate reference group smaller than 200 KB')
  try { return referenceDistribution.parse(JSON.parse(text)) }
  catch { throw new Error('The file must contain one aggregate group with its population, sample size and all 35 native score distributions.') }
}
