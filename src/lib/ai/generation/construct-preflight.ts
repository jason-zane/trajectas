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
import type { ConstructForGeneration, PreflightResult, ConstructPairResult } from '@/types/generation'

export const PREFLIGHT_SIMILARITY_THRESHOLD = 0.75

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

export async function runConstructPreflight(
  constructs: ConstructForGeneration[],
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
  const pairs: ConstructPairResult[] = []
  let llmPairCount = 0
  for (let i = 0; i < constructs.length; i++) {
    for (let j = i + 1; j < constructs.length; j++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[j])
      if (similarity <= PREFLIGHT_SIMILARITY_THRESHOLD) {
        pairs.push({
          constructAId: constructs[i].id,
          constructAName: constructs[i].name,
          constructBId: constructs[j].id,
          constructBName: constructs[j].name,
          cosineSimilarity: similarity,
          status: 'green',
        })
        continue
      }

      // 3. LLM discrimination check for similar pairs
      llmPairCount += 1
      let pairResult: ConstructPairResult
      try {
        const response = await openRouterProvider.complete({
          model:          preflightTask.modelId,
          systemPrompt:   prompt.content,
          prompt:         buildDiscriminationPrompt(
                            { name: constructs[i].name, definition: constructs[i].definition ?? constructs[i].name },
                            { name: constructs[j].name, definition: constructs[j].definition ?? constructs[j].name },
                          ),
          temperature:    preflightTask.config.temperature,
          maxTokens:      preflightTask.config.max_tokens,
          responseFormat: 'json',
        })

        const parsed = JSON.parse(response.content) as {
          canDiscriminate: boolean
          itemsForA: string[]
          itemsForB: string[]
          explanation: string
        }

        pairResult = {
          constructAId:          constructs[i].id,
          constructAName:        constructs[i].name,
          constructBId:          constructs[j].id,
          constructBName:        constructs[j].name,
          cosineSimilarity:      similarity,
          status:                parsed.canDiscriminate ? 'amber' : 'red',
          discriminatingItemsA:  parsed.itemsForA ?? [],
          discriminatingItemsB:  parsed.itemsForB ?? [],
          llmExplanation:        parsed.explanation,
        }
      } catch {
        pairResult = {
          constructAId:     constructs[i].id,
          constructAName:   constructs[i].name,
          constructBId:     constructs[j].id,
          constructBName:   constructs[j].name,
          cosineSimilarity: similarity,
          status:           'amber',
          llmExplanation:   'Could not complete discrimination check',
        }
      }
      pairs.push(pairResult)
    }
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
      pairCount: pairs.length,
      llmPairCount,
      embeddingModel: embeddingTask.modelId,
      preflightModel: llmPairCount > 0 ? preflightTask.modelId : undefined,
      promptVersion: prompt.version,
    },
  }
}
