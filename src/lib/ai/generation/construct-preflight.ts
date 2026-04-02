/**
 * construct-preflight.ts
 *
 * Step 0 of the AI-GENIE pipeline.
 * 1. Embeds construct definitions using text-embedding-3-small
 * 2. Computes pairwise cosine similarity between definition embeddings
 * 3. For pairs with similarity > 0.75, runs LLM discrimination check
 * 4. Returns PreflightResult with green/amber/red status per pair
 */
import { embedTexts } from './embeddings'
import { openRouterProvider } from '@/lib/ai/providers/openrouter'
import { getModelForTask } from '@/lib/ai/model-config'
import { getActiveSystemPrompt } from '@/lib/ai/prompt-config'
import { buildDiscriminationPrompt } from './prompts/construct-discrimination'
import type {
  ConstructDraftInput,
  ConstructForGeneration,
  ConstructChange,
  PreflightResult,
  ConstructPairResult,
  BigFiveMapping,
} from '@/types/generation'

export const PREFLIGHT_SIMILARITY_THRESHOLD = 0.75
export const PREFLIGHT_REVIEW_SIMILARITY_THRESHOLD = 0.5
export const PREFLIGHT_TOP_PAIR_COUNT = 5
export const PREFLIGHT_FULL_CONTEXT_THRESHOLD = 15

export interface PreflightPairCandidate {
  constructAIndex: number
  constructBIndex: number
  cosineSimilarity: number
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Builds the landscape context for a discrimination call, excluding the two
 * constructs being evaluated. For large sets (>PREFLIGHT_FULL_CONTEXT_THRESHOLD),
 * same-dimension constructs get fuller context.
 */
export function buildLandscapeContext(
  constructs: Array<{ id: string; name: string; definition?: string; description?: string; dimensionId?: string }>,
  indexA: number,
  indexB: number,
): Array<{ name: string; definition?: string }> {
  const excluded = new Set([indexA, indexB])
  const others = constructs.filter((_, i) => !excluded.has(i))

  if (constructs.length <= PREFLIGHT_FULL_CONTEXT_THRESHOLD) {
    return others.map((c) => ({ name: c.name, definition: c.definition }))
  }

  // Dimension-based grouping for large sets
  const dimA = constructs[indexA]?.dimensionId
  const dimB = constructs[indexB]?.dimensionId
  const sameDimIds = new Set([dimA, dimB].filter(Boolean))

  return others.map((c) => {
    if (c.dimensionId && sameDimIds.has(c.dimensionId)) {
      // Same dimension: include description for richer context
      const def = [c.definition, c.description].filter(Boolean).join('. ')
      return { name: c.name, definition: def || undefined }
    }
    // Cross-dimension: name + definition only
    return { name: c.name, definition: c.definition }
  })
}

export async function runConstructPreflight(
  constructs: Array<ConstructForGeneration | ConstructDraftInput>,
  changes?: ConstructChange[],
): Promise<PreflightResult> {
  if (constructs.length < 2) {
    const embeddingModel = (await getModelForTask('embedding')).modelId
    return {
      pairs: [],
      overallStatus: 'green',
      metadata: {
        similarityThreshold: PREFLIGHT_SIMILARITY_THRESHOLD,
        pairCount: 0,
        llmPairCount: 0,
        embeddingModel,
      },
    }
  }

  // 1. Embed all definitions
  const texts = constructs.map(c =>
    [c.name, c.definition ?? '', c.description ?? ''].filter(Boolean).join('. ')
  )
  const embeddingTask = await getModelForTask('embedding')
  const preflightTask = await getModelForTask('preflight_analysis')
  const embeddings = await embedTexts(texts, embeddingTask.modelId)
  const prompt = await getActiveSystemPrompt('preflight_analysis')

  // 2. Pairwise similarity
  const pairCandidates: PreflightPairCandidate[] = []
  for (let i = 0; i < constructs.length; i++) {
    for (let j = i + 1; j < constructs.length; j++) {
      pairCandidates.push({
        constructAIndex: i,
        constructBIndex: j,
        cosineSimilarity: cosineSimilarity(embeddings[i], embeddings[j]),
      })
    }
  }

  const reviewedPairs = selectPairsForLlmReview(pairCandidates)
  const pairs: ConstructPairResult[] = []
  let llmPairCount = 0
  for (const candidate of pairCandidates) {
    const i = candidate.constructAIndex
    const j = candidate.constructBIndex
    const similarity = candidate.cosineSimilarity
    const pairKey = buildPairKey(i, j)

    if (!reviewedPairs.has(pairKey)) {
      pairs.push({
        constructAId: constructs[i].id,
        constructAName: constructs[i].name,
        constructBId: constructs[j].id,
        constructBName: constructs[j].name,
        cosineSimilarity: similarity,
        status: 'green',
        reviewedByLlm: false,
      })
      continue
    }

    llmPairCount += 1
    let pairResult: ConstructPairResult
    try {
      const response = await openRouterProvider.complete({
        model: preflightTask.modelId,
        systemPrompt: prompt.content,
        prompt: buildDiscriminationPrompt(
          {
            name: constructs[i].name,
            definition: constructs[i].definition ?? constructs[i].name,
            description: constructs[i].description,
            indicatorsLow: 'indicatorsLow' in constructs[i] ? constructs[i].indicatorsLow : undefined,
            indicatorsMid: 'indicatorsMid' in constructs[i] ? constructs[i].indicatorsMid : undefined,
            indicatorsHigh: 'indicatorsHigh' in constructs[i] ? constructs[i].indicatorsHigh : undefined,
          },
          {
            name: constructs[j].name,
            definition: constructs[j].definition ?? constructs[j].name,
            description: constructs[j].description,
            indicatorsLow: 'indicatorsLow' in constructs[j] ? constructs[j].indicatorsLow : undefined,
            indicatorsMid: 'indicatorsMid' in constructs[j] ? constructs[j].indicatorsMid : undefined,
            indicatorsHigh: 'indicatorsHigh' in constructs[j] ? constructs[j].indicatorsHigh : undefined,
          },
          {
            otherConstructs: buildLandscapeContext(constructs, i, j),
            changes: changes?.filter((c) =>
              c.constructId === constructs[i].id || c.constructId === constructs[j].id
            ),
          },
        ),
        temperature: preflightTask.config.temperature,
        maxTokens: preflightTask.config.max_tokens,
        responseFormat: 'json',
      })

      const parsed = JSON.parse(response.content) as {
        canDiscriminate?: boolean
        status?: 'green' | 'amber' | 'red'
        overlapSummary?: string
        sharedSignals?: string[]
        uniqueSignalsA?: string[]
        uniqueSignalsB?: string[]
        itemsForA?: string[]
        itemsForB?: string[]
        refinementGuidanceA?: string
        refinementGuidanceB?: string
        explanation?: string
        bigFiveMappingA?: BigFiveMapping
        bigFiveMappingB?: BigFiveMapping
      }

      pairResult = {
        constructAId: constructs[i].id,
        constructAName: constructs[i].name,
        constructBId: constructs[j].id,
        constructBName: constructs[j].name,
        cosineSimilarity: similarity,
        status: normalizePreflightStatus(parsed.status, parsed.canDiscriminate, similarity),
        reviewedByLlm: true,
        overlapSummary: parsed.overlapSummary,
        sharedSignals: parsed.sharedSignals ?? [],
        uniqueSignalsA: parsed.uniqueSignalsA ?? [],
        uniqueSignalsB: parsed.uniqueSignalsB ?? [],
        discriminatingItemsA: parsed.itemsForA ?? [],
        discriminatingItemsB: parsed.itemsForB ?? [],
        refinementGuidanceA: parsed.refinementGuidanceA,
        refinementGuidanceB: parsed.refinementGuidanceB,
        llmExplanation: parsed.explanation,
        bigFiveMappingA: parseBigFiveMapping(parsed.bigFiveMappingA),
        bigFiveMappingB: parseBigFiveMapping(parsed.bigFiveMappingB),
      }
    } catch {
      pairResult = {
        constructAId: constructs[i].id,
        constructAName: constructs[i].name,
        constructBId: constructs[j].id,
        constructBName: constructs[j].name,
        cosineSimilarity: similarity,
        status: similarity >= PREFLIGHT_SIMILARITY_THRESHOLD ? 'red' : 'amber',
        reviewedByLlm: true,
        llmExplanation: 'Could not complete discrimination check',
      }
    }
    pairs.push(pairResult)
  }

  const overallStatus = pairs.some(p => p.status === 'red')
    ? 'red'
    : pairs.some(p => p.status === 'amber')
      ? 'amber'
      : 'green'

  return {
    pairs,
    overallStatus,
    metadata: {
      similarityThreshold: PREFLIGHT_SIMILARITY_THRESHOLD,
      reviewThreshold: PREFLIGHT_REVIEW_SIMILARITY_THRESHOLD,
      pairCount: pairs.length,
      llmPairCount,
      topPairsReviewed: PREFLIGHT_TOP_PAIR_COUNT,
      embeddingModel: embeddingTask.modelId,
      preflightModel: llmPairCount > 0 ? preflightTask.modelId : undefined,
      promptVersion: prompt.version,
    },
  }
}

export function selectPairsForLlmReview(
  pairCandidates: PreflightPairCandidate[],
  reviewThreshold = PREFLIGHT_REVIEW_SIMILARITY_THRESHOLD,
  topPairCount = PREFLIGHT_TOP_PAIR_COUNT,
): Set<string> {
  const rankedPairs = [...pairCandidates].sort((left, right) => right.cosineSimilarity - left.cosineSimilarity)
  const selected = new Set<string>()

  rankedPairs.slice(0, topPairCount).forEach((pair) => {
    selected.add(buildPairKey(pair.constructAIndex, pair.constructBIndex))
  })

  rankedPairs.forEach((pair) => {
    if (pair.cosineSimilarity >= reviewThreshold) {
      selected.add(buildPairKey(pair.constructAIndex, pair.constructBIndex))
    }
  })

  return selected
}

function normalizePreflightStatus(
  status: string | undefined,
  canDiscriminate: boolean | undefined,
  similarity: number,
): 'green' | 'amber' | 'red' {
  if (status === 'green' || status === 'amber' || status === 'red') {
    return status
  }
  if (canDiscriminate === false) return 'red'
  if (similarity >= PREFLIGHT_REVIEW_SIMILARITY_THRESHOLD) return 'amber'
  return 'green'
}

function buildPairKey(a: number, b: number): string {
  return `${a}:${b}`
}

function parseBigFiveMapping(raw: unknown): BigFiveMapping | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const obj = raw as Record<string, unknown>
  if (typeof obj.primaryDomain !== 'string') return undefined
  return {
    primaryDomain: obj.primaryDomain,
    knownFacetMatch: typeof obj.knownFacetMatch === 'string' ? obj.knownFacetMatch : null,
    intersectionDomains: Array.isArray(obj.intersectionDomains)
      ? obj.intersectionDomains.filter((d): d is string => typeof d === 'string')
      : undefined,
    note: typeof obj.note === 'string' ? obj.note : undefined,
  }
}
