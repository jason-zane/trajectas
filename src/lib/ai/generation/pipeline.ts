/**
 * pipeline.ts — Real AI-GENIE 7-step pipeline
 *
 * Step 0: Pre-flight (already run in wizard — optional here)
 * Step 1: Generate items via LLM (batches of 20, adaptive prompting)
 * Step 2: Embed all items via text-embedding-3-small
 * Step 3: Build correlation matrix + network (EGA)
 * Step 4: UVA — remove redundant items (wTO > 0.20)
 * Step 5: bootEGA — flag unstable items (stability < 0.75)
 * Step 6: Leakage detection
 * Step 7: Finalise + return scored candidates
 */
import { openRouterProvider }         from '@/lib/ai/providers/openrouter'
import { getModelForTask }            from '@/lib/ai/model-config'
import { embedTexts }                 from './embeddings'
import {
  ITEM_GENERATION_SYSTEM_PROMPT,
  buildItemGenerationPrompt,
  parseGeneratedItems,
}                                     from './prompts/item-generation'
import { cosineSimilarityMatrix }     from './network/correlation'
import { buildNetwork }               from './network/network-builder'
import { walktrap }                   from './network/walktrap'
import { computeNMI }                 from './network/nmi'
import { findRedundantItems }         from './network/wto'
import { bootstrapStability }         from './network/bootstrap'
import { detectLeakage }              from './network/leakage'
import type {
  ConstructForGeneration,
  ScoredCandidateItem,
  PipelineResult,
  GenerationRunConfig,
}                                     from '@/types/generation'
import type { ProgressCallback }      from './types'

const BATCH_SIZE       = 20
const WTO_CUTOFF       = 0.20
const STABILITY_CUTOFF = 0.75
const N_BOOTSTRAPS     = 50

export async function runPipeline(
  config:     GenerationRunConfig,
  constructs: ConstructForGeneration[],
  onProgress: ProgressCallback,
): Promise<{
  items:  ScoredCandidateItem[]
  result: PipelineResult
}> {
  const taskConfig = await getModelForTask('item_generation')
  const model      = config.generationModel ?? taskConfig.modelId
  let totalInputTokens  = 0
  let totalOutputTokens = 0

  // ---------------------------------------------------------------------------
  // Step 1: Generate items
  // ---------------------------------------------------------------------------
  await onProgress('item_generation', 10)
  const rawCandidates: Array<{
    constructId:   string
    stem:          string
    reverseScored: boolean
    rationale:     string
  }> = []

  const responseFormatDesc = 'A 5-point Likert scale from "Strongly Disagree" to "Strongly Agree"'

  for (const construct of constructs) {
    const target      = config.targetItemsPerConstruct
    const accumulated: string[] = []
    let attempts      = 0

    while (accumulated.length < target && attempts < target * 3) {
      attempts++
      const needed = Math.min(BATCH_SIZE, target - accumulated.length)
      const prompt = buildItemGenerationPrompt({
        construct,
        batchSize:                 needed,
        responseFormatDescription: responseFormatDesc,
        previousItems:             accumulated,
      })

      const response = await openRouterProvider.complete({
        model,
        systemPrompt:   ITEM_GENERATION_SYSTEM_PROMPT,
        prompt,
        temperature:    config.temperature ?? taskConfig.config.temperature,
        maxTokens:      taskConfig.config.max_tokens,
        responseFormat: 'json',
      })

      totalInputTokens  += response.usage.inputTokens
      totalOutputTokens += response.usage.outputTokens

      try {
        const parsed = parseGeneratedItems(response.content)
        for (const item of parsed) {
          if (item.stem && !accumulated.includes(item.stem)) {
            accumulated.push(item.stem)
            rawCandidates.push({ constructId: construct.id, ...item })
          }
        }
      } catch { /* skip malformed batch */ }
    }
  }

  await onProgress('embedding', 30, { itemsGenerated: rawCandidates.length })

  // ---------------------------------------------------------------------------
  // Step 2: Embed items
  // ---------------------------------------------------------------------------
  const stems      = rawCandidates.map(c => c.stem)
  const embeddings = await embedTexts(stems, config.embeddingModel)

  await onProgress('initial_ega', 50)

  // ---------------------------------------------------------------------------
  // Step 3: Initial EGA — build network + detect communities
  // ---------------------------------------------------------------------------
  const corrMatrix      = cosineSimilarityMatrix(embeddings)
  const { adjacency }   = buildNetwork(corrMatrix)
  const constructLabels = rawCandidates.map(c =>
    constructs.findIndex(co => co.id === c.constructId)
  )
  const communities  = walktrap(adjacency, constructLabels)
  const nmiInitial   = computeNMI(
    communities.map(c => c.communityId),
    constructLabels,
  )

  await onProgress('uva', 60)

  // ---------------------------------------------------------------------------
  // Step 4: UVA — redundancy removal
  // ---------------------------------------------------------------------------
  const { redundantIndices, wtoScores } = findRedundantItems(adjacency, WTO_CUTOFF)

  await onProgress('boot_ega', 75)

  // ---------------------------------------------------------------------------
  // Step 5: bootEGA — stability
  // ---------------------------------------------------------------------------
  const { stabilityScores, unstableIndices } = bootstrapStability(
    embeddings,
    constructLabels,
    N_BOOTSTRAPS,
    STABILITY_CUTOFF,
  )

  await onProgress('leakage', 90)

  // ---------------------------------------------------------------------------
  // Step 6: Leakage detection
  // ---------------------------------------------------------------------------
  const { leakingIndices } = detectLeakage(communities, constructLabels)
  void leakingIndices  // available for future use / logging

  // ---------------------------------------------------------------------------
  // Step 7: Final NMI on non-redundant, non-unstable items
  // ---------------------------------------------------------------------------
  const keptIndices   = rawCandidates
    .map((_, i) => i)
    .filter(i => !redundantIndices.has(i) && !unstableIndices.has(i))

  const keptPredicted = keptIndices.map(i => communities[i]?.communityId ?? 0)
  const keptActual    = keptIndices.map(i => constructLabels[i])
  const nmiFinal      = computeNMI(keptPredicted, keptActual)

  // ---------------------------------------------------------------------------
  // Assemble scored items
  // ---------------------------------------------------------------------------
  const scoredItems: ScoredCandidateItem[] = rawCandidates.map((c, i) => ({
    constructId:   c.constructId,
    stem:          c.stem,
    reverseScored: c.reverseScored,
    rationale:     c.rationale,
    embedding:     embeddings[i] ?? [],
    communityId:   communities[i]?.communityId,
    wtoMax:        wtoScores[i],
    bootStability: stabilityScores[i],
    isRedundant:   redundantIndices.has(i),
    isUnstable:    unstableIndices.has(i),
  }))

  const itemsAfterUva  = rawCandidates.length - redundantIndices.size
  const itemsAfterBoot = itemsAfterUva -
    [...unstableIndices].filter(i => !redundantIndices.has(i)).length

  await onProgress('final', 100)

  return {
    items: scoredItems,
    result: {
      runId:          '',  // filled by caller
      itemsGenerated: rawCandidates.length,
      itemsAfterUva,
      itemsAfterBoot,
      nmiInitial,
      nmiFinal,
      modelUsed:   model,
      tokenUsage:  { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    },
  }
}
