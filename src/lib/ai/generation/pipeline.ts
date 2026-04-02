/**
 * pipeline.ts — paper-faithful AI-GENIE pipeline
 *
 * 1. Generate items via LLM
 * 2. Embed all items
 * 3. Initial EGA on the full item pool
 * 4. Global UVA on sparse embeddings
 * 5. Choose full vs sparse embeddings for the remaining stages
 * 6. Iterative bootEGA until all remaining items are stable
 * 7. Final EGA + diagnostics for review
 */
import { openRouterProvider } from '@/lib/ai/providers/openrouter'
import { getModelForTask } from '@/lib/ai/model-config'
import { getActiveSystemPrompt } from '@/lib/ai/prompt-config'
import { embedTexts } from './embeddings'
import {
  buildItemGenerationPrompt,
  parseGeneratedItems,
} from './prompts/item-generation'
import {
  itemCorrelationMatrix,
  sparsifyEmbeddings,
} from './network/correlation'
import { buildNetwork } from './network/network-builder'
import { walktrap } from './network/walktrap'
import { computeNMI } from './network/nmi'
import { findRedundantItemsIterative } from './network/wto'
import { alignCommunitiesToReference, bootstrapStability } from './network/bootstrap'
import type {
  ConstructForGeneration,
  EmbeddingType,
  NetworkEstimator,
  ScoredCandidateItem,
  PipelineResult,
  GenerationRunConfig,
} from '@/types/generation'
import type { ProgressCallback } from './types'

const BATCH_SIZE = 20
const WTO_CUTOFF = 0.20
const STABILITY_CUTOFF = 0.75
const N_BOOTSTRAPS = 100
const WALKTRAP_STEP_CANDIDATES = [3, 4, 5, 6] as const

interface RunPipelineOptions {
  responseFormatDescription?: string
}

interface EgaRun {
  communities: number[]
  alignedCommunities: number[]
  nmi: number
  walktrapStep: number
}

export async function runPipeline(
  config: GenerationRunConfig,
  constructs: ConstructForGeneration[],
  onProgress: ProgressCallback,
  options: RunPipelineOptions = {},
): Promise<{
  items: ScoredCandidateItem[]
  result: PipelineResult
}> {
  const taskConfig = await getModelForTask('item_generation')
  const promptPurpose = config.promptPurpose ?? 'item_generation'
  const itemPrompt = await getActiveSystemPrompt(promptPurpose)
  const model = config.generationModel ?? taskConfig.modelId
  const embeddingModel = config.embeddingModel || (await getModelForTask('embedding')).modelId
  const estimator: NetworkEstimator = config.networkEstimator ?? 'tmfg'
  const responseFormatDesc =
    options.responseFormatDescription ??
    'A 5-point Likert scale from "Strongly Disagree" to "Strongly Agree"'

  let totalInputTokens = 0
  let totalOutputTokens = 0

  await onProgress('item_generation', 10)

  const rawCandidates: Array<{
    constructId: string
    stem: string
    reverseScored: boolean
    rationale: string
    difficultyTier?: string
    sdRisk?: string
    facet?: string
  }> = []
  const seenByConstruct = new Map<string, Set<string>>()
  const MAX_CONSECUTIVE_FAILURES = 5

  for (const construct of constructs) {
    const target = config.targetItemsPerConstruct
    const existingNormalized = new Set(
      (construct.existingItems ?? []).map(stem => normalizeStem(stem))
    )
    const accumulated: string[] = []
    let attempts = 0
    let consecutiveFailures = 0

    while (accumulated.length < target && attempts < Math.ceil(target / BATCH_SIZE) + 8) {
      attempts++
      const needed = BATCH_SIZE
      const contrastConstructs = constructs
        .filter(other => other.id !== construct.id)
        .slice(0, 6)
      // Collect facets from already-generated items for this construct
      const accumulatedFacets = rawCandidates
        .filter((c) => c.constructId === construct.id && c.facet)
        .map((c) => c.facet!)
      // Only include facet guidance if we have enough data (>50% of items have facets)
      const previousFacets = accumulatedFacets.length >= accumulated.length * 0.5
        ? [...new Set(accumulatedFacets)]
        : []

      const prompt = buildItemGenerationPrompt({
        construct,
        batchSize: needed,
        responseFormatDescription: responseFormatDesc,
        previousItems: [...(construct.existingItems ?? []), ...accumulated],
        previousFacets,
        contrastConstructs,
      })

      const response = await openRouterProvider.complete({
        model,
        systemPrompt: itemPrompt.content,
        prompt,
        temperature: config.temperature ?? taskConfig.config.temperature,
        maxTokens: taskConfig.config.max_tokens,
        responseFormat: 'json',
      })

      totalInputTokens += response.usage.inputTokens
      totalOutputTokens += response.usage.outputTokens

      try {
        const parsed = parseGeneratedItems(response.content)
        if (parsed.length === 0) {
          consecutiveFailures++
          console.warn(`[pipeline] ${construct.name} batch ${attempts}: 0 items parsed (consecutive failures: ${consecutiveFailures})`)
          continue
        }

        consecutiveFailures = 0
        const constructSeen = seenByConstruct.get(construct.id) ?? new Set<string>(existingNormalized)
        let duplicatesInBatch = 0

        for (const item of parsed) {
          const normalizedStem = normalizeStem(item.stem)
          if (!normalizedStem || constructSeen.has(normalizedStem)) {
            duplicatesInBatch++
            continue
          }
          constructSeen.add(normalizedStem)
          accumulated.push(item.stem)
          rawCandidates.push({
            constructId: construct.id,
            stem: item.stem,
            reverseScored: item.reverseScored,
            rationale: item.rationale,
            difficultyTier: item.difficultyTier,
            sdRisk: item.sdRisk,
            facet: item.facet,
          })
          if (accumulated.length >= target) break
        }

        console.log(`[pipeline] ${construct.name} batch ${attempts}: ${parsed.length} parsed, ${duplicatesInBatch} duplicates, ${accumulated.length}/${target} accumulated`)
        seenByConstruct.set(construct.id, constructSeen)
      } catch {
        consecutiveFailures++
        console.warn(`[pipeline] ${construct.name} batch ${attempts}: parse error (consecutive failures: ${consecutiveFailures})`)
      }

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn(`[pipeline] ${construct.name}: stopping after ${MAX_CONSECUTIVE_FAILURES} consecutive failures (${accumulated.length}/${target} items)`)
        break
      }
    }

    if (accumulated.length < target) {
      console.warn(`[pipeline] ${construct.name}: finished with ${accumulated.length}/${target} items after ${attempts} attempts`)
    }
  }

  await onProgress('embedding', 30, { itemsGenerated: rawCandidates.length })

  const stems = rawCandidates.map(candidate => candidate.stem)
  const fullEmbeddings = await embedTexts(stems, embeddingModel)
  const sparseEmbeddings = sparsifyEmbeddings(fullEmbeddings)
  const constructLabels = rawCandidates.map(candidate =>
    constructs.findIndex(construct => construct.id === candidate.constructId)
  )
  const isMultiConstruct = new Set(constructLabels).size > 1

  await onProgress('initial_ega', 50)

  const initialEga = runEga(fullEmbeddings, constructLabels, estimator, isMultiConstruct)
  const initialCommunityIds = initialEga.alignedCommunities

  await onProgress('uva', 62)

  const {
    redundantIndices,
    wtoScores,
    removalSweepByIndex: uvaRemovalSweeps = new Map<number, number>(),
    sweepCount: uvaSweepCount = 0,
  } = findRedundantItemsIterative(
    sparseEmbeddings,
    WTO_CUTOFF,
  )

  const keptAfterUvaIndices = rawCandidates
    .map((_, index) => index)
    .filter(index => !redundantIndices.has(index))

  const postUvaEga = keptAfterUvaIndices.length >= 2
    ? runEga(
        keptAfterUvaIndices.map(index => fullEmbeddings[index]!),
        keptAfterUvaIndices.map(index => constructLabels[index]!),
        estimator,
        isMultiConstruct,
      )
    : null

  let selectedEmbeddingType: EmbeddingType = 'full'
  let selectedWalktrapStep = postUvaEga?.walktrapStep ?? initialEga.walktrapStep
  let postEmbeddingSelectionNmi: number | undefined = postUvaEga?.nmi

  if (isMultiConstruct && keptAfterUvaIndices.length >= 2) {
    const fullCandidate = runEga(
      keptAfterUvaIndices.map(index => fullEmbeddings[index]!),
      keptAfterUvaIndices.map(index => constructLabels[index]!),
      estimator,
      true,
    )
    const sparseCandidate = runEga(
      keptAfterUvaIndices.map(index => sparseEmbeddings[index]!),
      keptAfterUvaIndices.map(index => constructLabels[index]!),
      estimator,
      true,
    )

    if (sparseCandidate.nmi > fullCandidate.nmi) {
      selectedEmbeddingType = 'sparse'
      selectedWalktrapStep = sparseCandidate.walktrapStep
      postEmbeddingSelectionNmi = sparseCandidate.nmi
    } else {
      selectedWalktrapStep = fullCandidate.walktrapStep
      postEmbeddingSelectionNmi = fullCandidate.nmi
    }
  }

  await onProgress('boot_ega', 78)

  const bootRemovalSweeps = new Map<number, number>()
  const stabilityScores = new Array<number | undefined>(rawCandidates.length).fill(undefined)
  const unstableIndices = new Set<number>()

  let bootSweeps = 0
  let activeIndices = [...keptAfterUvaIndices]
  const finalCommunityIds = new Array<number | undefined>(rawCandidates.length).fill(undefined)
  let finalNmi: number | undefined = postEmbeddingSelectionNmi
  let postBootNmi: number | undefined = postEmbeddingSelectionNmi
  let finalWalktrapStep = selectedWalktrapStep

  if (isMultiConstruct && activeIndices.length >= 2) {
    for (;;) {
      bootSweeps += 1
      const activeEmbeddings = activeIndices.map(index =>
        (selectedEmbeddingType === 'sparse' ? sparseEmbeddings : fullEmbeddings)[index]!
      )
      const activeLabels = activeIndices.map(index => constructLabels[index]!)
      const ega = runEga(activeEmbeddings, activeLabels, estimator, true)
      finalWalktrapStep = ega.walktrapStep

      const boot = bootstrapStability(
        activeEmbeddings,
        ega.alignedCommunities,
        estimator,
        ega.walktrapStep,
        N_BOOTSTRAPS,
        STABILITY_CUTOFF,
      )

      activeIndices.forEach((globalIndex, localIndex) => {
        stabilityScores[globalIndex] = boot.stabilityScores[localIndex]
      })

      if (boot.unstableIndices.size === 0) {
        postBootNmi = ega.nmi
        finalNmi = ega.nmi
        activeIndices.forEach((globalIndex, localIndex) => {
          finalCommunityIds[globalIndex] = ega.alignedCommunities[localIndex]
        })
        break
      }

      const victims = [...boot.unstableIndices].map(localIndex => activeIndices[localIndex]!)
      victims.forEach(globalIndex => {
        unstableIndices.add(globalIndex)
        bootRemovalSweeps.set(globalIndex, bootSweeps)
      })
      activeIndices = activeIndices.filter(index => !unstableIndices.has(index))

      if (activeIndices.length < 2) {
        finalNmi = ega.nmi
        postBootNmi = ega.nmi
        break
      }
    }
  } else {
    activeIndices.forEach(index => {
      stabilityScores[index] = 1
    })
    const activeEmbeddings = activeIndices.map(index =>
      (selectedEmbeddingType === 'sparse' ? sparseEmbeddings : fullEmbeddings)[index]!
    )
    const activeLabels = activeIndices.map(index => constructLabels[index]!)
    if (activeEmbeddings.length >= 2) {
      const ega = runEga(activeEmbeddings, activeLabels, estimator, isMultiConstruct)
      finalWalktrapStep = ega.walktrapStep
      finalNmi = ega.nmi
      postBootNmi = ega.nmi
      activeIndices.forEach((globalIndex, localIndex) => {
        finalCommunityIds[globalIndex] = ega.alignedCommunities[localIndex]
      })
    } else {
      activeIndices.forEach(index => {
        finalCommunityIds[index] = initialCommunityIds[index]
      })
      finalNmi = undefined
      postBootNmi = undefined
    }
  }

  await onProgress('final', 100)

  const itemsAfterUva = rawCandidates.length - redundantIndices.size
  const itemsAfterBoot = itemsAfterUva - [...unstableIndices].filter(index => !redundantIndices.has(index)).length

  const scoredItems: ScoredCandidateItem[] = rawCandidates.map((candidate, index) => {
    const removalStage = redundantIndices.has(index)
      ? 'uva'
      : unstableIndices.has(index)
        ? 'boot_ega'
        : 'kept'

    const removalSweep =
      uvaRemovalSweeps.get(index) ??
      bootRemovalSweeps.get(index)

    return {
      constructId: candidate.constructId,
      stem: candidate.stem,
      reverseScored: candidate.reverseScored,
      rationale: candidate.rationale,
      difficultyTier: candidate.difficultyTier as ScoredCandidateItem['difficultyTier'],
      sdRisk: candidate.sdRisk as ScoredCandidateItem['sdRisk'],
      facet: candidate.facet,
      embedding: fullEmbeddings[index] ?? [],
      communityId: finalCommunityIds[index] ?? initialCommunityIds[index],
      initialCommunityId: initialCommunityIds[index],
      finalCommunityId: finalCommunityIds[index],
      wtoMax: wtoScores[index],
      bootStability: stabilityScores[index],
      removalStage,
      removalSweep,
      isRedundant: redundantIndices.has(index),
      isUnstable: unstableIndices.has(index),
    }
  })

  return {
    items: scoredItems,
    result: {
      runId: '',
      itemsGenerated: rawCandidates.length,
      itemsAfterUva,
      itemsAfterBoot,
      nmiInitial: initialEga.nmi,
      nmiFinal: finalNmi,
      modelUsed: model,
      aiSnapshot: {
        models: {
          item_generation: model,
          embedding: embeddingModel,
        },
        prompts: {
          [promptPurpose]: { id: itemPrompt.id, version: itemPrompt.version },
        },
        embeddingType: selectedEmbeddingType,
        networkEstimator: estimator,
        walktrapStep: finalWalktrapStep,
        nmiByStage: {
          initial: initialEga.nmi,
          ...(postUvaEga ? { postUva: postUvaEga.nmi } : {}),
          ...(postEmbeddingSelectionNmi !== undefined ? { postEmbeddingSelection: postEmbeddingSelectionNmi } : {}),
          ...(postBootNmi !== undefined ? { postBoot: postBootNmi } : {}),
          ...(finalNmi !== undefined ? { final: finalNmi } : {}),
        },
        uvaSweeps: uvaSweepCount,
        bootSweeps,
      },
      tokenUsage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      },
    },
  }
}

function runEga(
  embeddings: number[][],
  actualLabels: number[],
  estimator: NetworkEstimator,
  isMultiConstruct: boolean,
): EgaRun {
  if (embeddings.length === 0) {
    return { communities: [], alignedCommunities: [], nmi: 0, walktrapStep: WALKTRAP_STEP_CANDIDATES[1] }
  }

  const corrMatrix = itemCorrelationMatrix(embeddings)
  const { adjacency } = buildNetwork(corrMatrix, estimator)

  if (!isMultiConstruct) {
    const communities = walktrap(adjacency, actualLabels, WALKTRAP_STEP_CANDIDATES[1])
      .map(entry => entry.communityId)
    return {
      communities,
      alignedCommunities: communities,
      nmi: 1,
      walktrapStep: WALKTRAP_STEP_CANDIDATES[1],
    }
  }

  let best: EgaRun | null = null
  for (const step of WALKTRAP_STEP_CANDIDATES) {
    const communities = walktrap(adjacency, actualLabels, step).map(entry => entry.communityId)
    const alignedCommunities = alignCommunitiesToReference(communities, actualLabels)
    const nmi = computeNMI(communities, actualLabels)

    if (!best || nmi > best.nmi || (nmi === best.nmi && step < best.walktrapStep)) {
      best = { communities, alignedCommunities, nmi, walktrapStep: step }
    }
  }

  return best ?? { communities: [], alignedCommunities: [], nmi: 0, walktrapStep: WALKTRAP_STEP_CANDIDATES[1] }
}

function normalizeStem(stem: string): string {
  return stem
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
