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
import { getModelForTask } from '@/lib/ai/model-resolver'
import { DISCRIMINATION_SYSTEM_PROMPT, buildDiscriminationPrompt } from './prompts/construct-discrimination'
import type { ConstructForGeneration, PreflightResult, ConstructPairResult } from '@/types/generation'

const SIMILARITY_THRESHOLD = 0.75

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
    return { pairs: [], overallStatus: 'green' }
  }

  // 1. Embed all definitions
  const texts = constructs.map(c =>
    [c.name, c.definition ?? '', c.description ?? ''].filter(Boolean).join('. ')
  )
  const embeddings = await embedTexts(texts)

  // 2. Pairwise similarity
  const pairs: ConstructPairResult[] = []
  for (let i = 0; i < constructs.length; i++) {
    for (let j = i + 1; j < constructs.length; j++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[j])
      if (similarity <= SIMILARITY_THRESHOLD) {
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
      const modelConfig = await getModelForTask('preflight_analysis')
      let pairResult: ConstructPairResult
      try {
        const response = await openRouterProvider.complete({
          model:          modelConfig.model,
          systemPrompt:   DISCRIMINATION_SYSTEM_PROMPT,
          prompt:         buildDiscriminationPrompt(
                            { name: constructs[i].name, definition: constructs[i].definition ?? constructs[i].name },
                            { name: constructs[j].name, definition: constructs[j].definition ?? constructs[j].name },
                          ),
          temperature:    modelConfig.temperature,
          maxTokens:      modelConfig.maxTokens,
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

  return { pairs, overallStatus }
}
