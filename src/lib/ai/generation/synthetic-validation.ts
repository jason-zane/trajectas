/**
 * synthetic-validation.ts
 *
 * Generates synthetic respondent personas, simulates Likert responses via LLM,
 * and runs basic psychometric analyses on the synthetic data.
 *
 * IMPORTANT: LLM-simulated data replicates group-level latent structures but
 * does NOT approximate individual-level response distributions. Results should
 * be presented as "estimated" — useful for flagging structural problems, not
 * for establishing exact reliability coefficients.
 */

import { openRouterProvider } from '@/lib/ai/providers/openrouter'
import { getModelForTask } from '@/lib/ai/model-config'
import { getActiveSystemPrompt } from '@/lib/ai/prompt-config'
import type { ScoredCandidateItem } from '@/types/generation'

// ---------------------------------------------------------------------------
// Persona generation
// ---------------------------------------------------------------------------

export interface SyntheticPersona {
  id: number
  description: string
  traitLevels: Record<string, 'low' | 'moderate' | 'high'>
}

interface ConstructInfo {
  id: string
  name: string
}

const ROLE_LEVELS = ['Junior professional', 'Mid-level professional', 'Senior professional', 'Executive leader']
const EXPERIENCE_YEARS = [2, 5, 10, 15, 20]
const TRAIT_LEVELS: Array<'low' | 'moderate' | 'high'> = ['low', 'moderate', 'high']

export function generatePersonas(
  constructs: ConstructInfo[],
  count: number,
): SyntheticPersona[] {
  const personas: SyntheticPersona[] = []

  for (let i = 0; i < count; i++) {
    const role = ROLE_LEVELS[i % ROLE_LEVELS.length]
    const experience = EXPERIENCE_YEARS[i % EXPERIENCE_YEARS.length]

    const traitLevels: Record<string, 'low' | 'moderate' | 'high'> = {}
    for (let j = 0; j < constructs.length; j++) {
      traitLevels[constructs[j].id] = TRAIT_LEVELS[(i + j) % TRAIT_LEVELS.length]
    }

    const traitDesc = constructs
      .map((c) => `${traitLevels[c.id]} ${c.name}`)
      .join(', ')

    personas.push({
      id: i,
      description: `${role} with ${experience} years of experience. Trait profile: ${traitDesc}.`,
      traitLevels,
    })
  }

  return personas
}

// ---------------------------------------------------------------------------
// Response simulation
// ---------------------------------------------------------------------------

export interface SyntheticResponse {
  itemIndex: number
  rating: number
}

export function buildRespondentPrompt(
  persona: SyntheticPersona,
  items: Array<{ stem: string; reverseScored: boolean }>,
): string {
  const itemsList = items
    .map((item, i) => `${i}. "${item.stem}"${item.reverseScored ? ' (reverse-scored)' : ''}`)
    .join('\n')

  return `You are this person: ${persona.description}

Rate each item on a 1-5 scale (1=Strongly Disagree, 5=Strongly Agree) as this person would naturally respond.

Items:
${itemsList}

Return a JSON array: [{ "itemIndex": 0, "rating": 4 }, ...]`
}

export function parseSyntheticResponses(jsonContent: string): SyntheticResponse[] | null {
  try {
    const cleaned = jsonContent
      .replace(/^```(?:json)?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim()

    let parsed = JSON.parse(cleaned) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>
      const firstArray = Object.values(obj).find(Array.isArray)
      if (firstArray) parsed = firstArray
    }
    if (!Array.isArray(parsed)) return null

    return parsed.filter(
      (item): item is SyntheticResponse =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).itemIndex === 'number' &&
        typeof (item as Record<string, unknown>).rating === 'number' &&
        ((item as Record<string, unknown>).rating as number) >= 1 &&
        ((item as Record<string, unknown>).rating as number) <= 5,
    )
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Psychometric analyses
// ---------------------------------------------------------------------------

export function computeCronbachAlpha(matrix: number[][]): number {
  const n = matrix.length
  const k = matrix[0]?.length ?? 0
  if (k <= 1 || n <= 1) return 0

  const itemMeans = new Array(k).fill(0)
  for (let j = 0; j < k; j++) {
    for (let i = 0; i < n; i++) {
      itemMeans[j] += matrix[i][j]
    }
    itemMeans[j] /= n
  }

  const itemVariances = new Array(k).fill(0)
  for (let j = 0; j < k; j++) {
    for (let i = 0; i < n; i++) {
      itemVariances[j] += (matrix[i][j] - itemMeans[j]) ** 2
    }
    itemVariances[j] /= (n - 1)
  }

  const totalScores = matrix.map((row) => row.reduce((a, b) => a + b, 0))
  const totalMean = totalScores.reduce((a, b) => a + b, 0) / n
  const totalVariance = totalScores.reduce((sum, s) => sum + (s - totalMean) ** 2, 0) / (n - 1)

  if (totalVariance === 0) return 0

  const sumItemVariances = itemVariances.reduce((a, b) => a + b, 0)

  return (k / (k - 1)) * (1 - sumItemVariances / totalVariance)
}

export function computeItemTotalCorrelations(matrix: number[][]): number[] {
  const n = matrix.length
  const k = matrix[0]?.length ?? 0
  if (k <= 1 || n <= 1) return new Array(k).fill(0)

  const totalScores = matrix.map((row) => row.reduce((a, b) => a + b, 0))
  const meanTotal = totalScores.reduce((a, b) => a + b, 0) / n

  return Array.from({ length: k }, (_, j) => {
    const itemScores = matrix.map((row) => row[j])

    const meanItem = itemScores.reduce((a, b) => a + b, 0) / n

    let cov = 0, varItem = 0, varTotal = 0
    for (let i = 0; i < n; i++) {
      const dItem = itemScores[i] - meanItem
      const dTotal = totalScores[i] - meanTotal
      cov += dItem * dTotal
      varItem += dItem * dItem
      varTotal += dTotal * dTotal
    }

    if (varItem === 0 || varTotal === 0) return 0
    return cov / (Math.sqrt(varItem) * Math.sqrt(varTotal))
  })
}

// ---------------------------------------------------------------------------
// Full synthetic validation orchestrator
// ---------------------------------------------------------------------------

export interface SyntheticValidationResult {
  respondentsGenerated: number
  estimatedAlpha: Record<string, number>
  itemTotalCorrelations: Record<string, number[]>
  constructsAnalyzed: number
  warnings: string[]
}

export async function runSyntheticValidation(
  items: ScoredCandidateItem[],
  constructs: Array<{ id: string; name: string }>,
  respondentCount: number = 50,
  onProgress?: (message: string) => void,
): Promise<SyntheticValidationResult> {
  let syntheticModel: string
  let syntheticSystemPrompt: string
  try {
    const task = await getModelForTask('synthetic_respondent')
    const promptData = await getActiveSystemPrompt('synthetic_respondent')
    syntheticModel = task.modelId
    syntheticSystemPrompt = promptData.content
  } catch {
    return {
      respondentsGenerated: 0,
      estimatedAlpha: {},
      itemTotalCorrelations: {},
      constructsAnalyzed: 0,
      warnings: ['Synthetic respondent model/prompt not configured'],
    }
  }

  const keptItems = items.filter((i) => i.removalStage === 'kept')
  if (keptItems.length < 3) {
    return {
      respondentsGenerated: 0,
      estimatedAlpha: {},
      itemTotalCorrelations: {},
      constructsAnalyzed: 0,
      warnings: ['Too few items for synthetic validation (need at least 3)'],
    }
  }

  const personas = generatePersonas(constructs, respondentCount)
  onProgress?.(`Generated ${personas.length} synthetic personas`)

  const responseMatrix: number[][] = []
  const itemStems = keptItems.map((i) => ({ stem: i.stem, reverseScored: i.reverseScored }))

  for (const persona of personas) {
    try {
      const prompt = buildRespondentPrompt(persona, itemStems)
      const response = await openRouterProvider.complete({
        model: syntheticModel,
        systemPrompt: syntheticSystemPrompt,
        prompt,
        temperature: 0.7,
        maxTokens: 4096,
        responseFormat: 'json',
      })

      const ratings = parseSyntheticResponses(response.content)
      if (ratings && ratings.length > 0) {
        const row = new Array(keptItems.length).fill(3)
        for (const r of ratings) {
          if (r.itemIndex >= 0 && r.itemIndex < keptItems.length) {
            row[r.itemIndex] = r.rating
          }
        }
        responseMatrix.push(row)
      }
    } catch {
      // Skip failed persona
    }

    if (responseMatrix.length % 10 === 0) {
      onProgress?.(`Simulated ${responseMatrix.length}/${personas.length} respondents`)
    }
  }

  if (responseMatrix.length < 10) {
    return {
      respondentsGenerated: responseMatrix.length,
      estimatedAlpha: {},
      itemTotalCorrelations: {},
      constructsAnalyzed: 0,
      warnings: [`Only ${responseMatrix.length} respondents completed — too few for reliable analysis`],
    }
  }

  const estimatedAlpha: Record<string, number> = {}
  const itemTotalCorrelations: Record<string, number[]> = {}
  const warnings: string[] = []

  for (const construct of constructs) {
    const constructItemIndices = keptItems
      .map((item, idx) => ({ idx, constructId: item.constructId }))
      .filter((x) => x.constructId === construct.id)
      .map((x) => x.idx)

    if (constructItemIndices.length < 2) {
      warnings.push(`${construct.name}: too few items for alpha calculation`)
      continue
    }

    const subMatrix = responseMatrix.map((row) =>
      constructItemIndices.map((idx) => row[idx])
    )

    const alpha = computeCronbachAlpha(subMatrix)
    estimatedAlpha[construct.id] = alpha

    if (alpha < 0.7) {
      warnings.push(`${construct.name}: estimated alpha ${alpha.toFixed(2)} is below 0.70 threshold`)
    }

    const itc = computeItemTotalCorrelations(subMatrix)
    itemTotalCorrelations[construct.id] = itc

    itc.forEach((corr, i) => {
      if (corr < 0.3) {
        const itemStem = keptItems[constructItemIndices[i]]?.stem ?? 'unknown'
        warnings.push(`${construct.name}: item "${itemStem.slice(0, 40)}..." has low item-total correlation (${corr.toFixed(2)})`)
      }
    })
  }

  const constructsAnalyzed = Object.keys(estimatedAlpha).length

  onProgress?.(`Synthetic validation complete: ${responseMatrix.length} respondents, ${constructsAnalyzed} constructs analyzed`)

  return {
    respondentsGenerated: responseMatrix.length,
    estimatedAlpha,
    itemTotalCorrelations,
    constructsAnalyzed,
    warnings,
  }
}
