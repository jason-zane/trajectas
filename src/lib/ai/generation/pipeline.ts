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
import { buildCritiquePrompt, parseCritiqueResponse } from './prompts/item-critique'
import { ConstructCentroidCache, checkItemLeakage } from './leakage-guard'
import {
  computeDifficultyEstimate,
  analyzeDifficultyDistribution,
  buildDifficultySteering,
} from './difficulty-targeting'
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

  // Tier 2: Item Critique model (separate from generation)
  const critiqueEnabled = config.enableItemCritique !== false
  let critiqueModel: string | undefined
  let critiqueSystemPrompt: string | undefined
  if (critiqueEnabled) {
    try {
      const critiqueTask = await getModelForTask('item_critique')
      const critiquePromptData = await getActiveSystemPrompt('item_critique')
      critiqueModel = critiqueTask.modelId
      critiqueSystemPrompt = critiquePromptData.content
    } catch {
      console.warn('[pipeline] Item critique model/prompt not configured, skipping critique stage')
    }
  }

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

  // Tier 2: Critique stage tracking
  const critiqueStats = { itemsReviewed: 0, kept: 0, revised: 0, dropped: 0, critiqueFailed: false }
  const critiqueVerdicts = new Map<string, { verdict: 'kept' | 'revised' | 'dropped'; reason?: string; originalStem?: string }>()

  // Tier 2: Leakage Guard — seed construct centroids from definitions
  const leakageEnabled = config.enableLeakageGuard !== false && constructs.length >= 2
  const centroidCache = new ConstructCentroidCache()
  const leakageStats = { itemsChecked: 0, flagged: 0 }
  const stemEmbeddingCache = new Map<string, number[]>()

  // Tier 2: Difficulty Targeting
  const difficultyEnabled = config.enableDifficultyTargeting === true
  const difficultyEstimates = new Map<number, number>()

  if (leakageEnabled) {
    // Embed construct definitions to seed centroids
    const definitionTexts = constructs.map((c) =>
      [c.name, c.definition ?? '', c.description ?? ''].filter(Boolean).join('. ')
    )
    const definitionEmbeddings = await embedTexts(definitionTexts, embeddingModel)
    constructs.forEach((c, i) => {
      centroidCache.seed(c.id, definitionEmbeddings[i])
    })
  }

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

      // Tier 2: Difficulty Targeting — steer based on current pool skew
      // Per-batch steering requires cached embeddings from leakage guard
      let difficultySteering = ''
      if (difficultyEnabled && !leakageEnabled && attempts === 1) {
        console.log(`[pipeline] ${construct.name}: difficulty targeting enabled but leakage guard off — per-batch steering unavailable, post-generation estimates will still be computed`)
      }
      if (difficultyEnabled && leakageEnabled && accumulated.length >= BATCH_SIZE) {
        // Get embeddings for accumulated items from cache
        const accEstimates: number[] = []
        for (const stem of accumulated) {
          const embedding = stemEmbeddingCache.get(stem)
          const centroid = centroidCache.getCentroid(construct.id)
          if (embedding && centroid) {
            accEstimates.push(computeDifficultyEstimate(embedding, centroid))
          }
        }
        if (accEstimates.length > 0) {
          const distribution = analyzeDifficultyDistribution(accEstimates)
          difficultySteering = buildDifficultySteering(distribution.skew)
        }
      }

      const prompt = buildItemGenerationPrompt({
        construct,
        batchSize: needed,
        responseFormatDescription: responseFormatDesc,
        previousItems: [...(construct.existingItems ?? []), ...accumulated],
        previousFacets,
        difficultySteering,
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

        // Tier 2: Item Critique — review batch before deduplication
        let critiquedItems = parsed
        if (critiqueEnabled && critiqueModel && critiqueSystemPrompt) {
          try {
            // Reuse the contrastConstructs already computed at the top of the batch loop
            const critiquePrompt = buildCritiquePrompt({
              items: parsed,
              constructName: construct.name,
              constructDefinition: construct.definition,
              constructDescription: construct.description,
              constructIndicatorsLow: construct.indicatorsLow,
              constructIndicatorsMid: construct.indicatorsMid,
              constructIndicatorsHigh: construct.indicatorsHigh,
              contrastConstructs: contrastConstructs.map((c) => ({
                name: c.name,
                definition: c.definition,
              })),
            })

            const critiqueResponse = await openRouterProvider.complete({
              model: critiqueModel,
              systemPrompt: critiqueSystemPrompt,
              prompt: critiquePrompt,
              temperature: 0.3,
              maxTokens: 4096,
              responseFormat: 'json',
            })

            totalInputTokens += critiqueResponse.usage.inputTokens
            totalOutputTokens += critiqueResponse.usage.outputTokens

            const verdicts = parseCritiqueResponse(critiqueResponse.content)
            if (verdicts) {
              critiqueStats.itemsReviewed += parsed.length
              const survivingItems: typeof parsed = []

              for (const item of parsed) {
                const verdict = verdicts.find((v) => v.originalStem === item.stem)
                if (!verdict || verdict.verdict === 'keep') {
                  critiqueStats.kept++
                  critiqueVerdicts.set(item.stem, { verdict: 'kept' })
                  survivingItems.push(item)
                } else if (verdict.verdict === 'revise' && verdict.revisedStem) {
                  critiqueStats.revised++
                  critiqueVerdicts.set(verdict.revisedStem, {
                    verdict: 'revised',
                    reason: verdict.reason,
                    originalStem: item.stem,
                  })
                  survivingItems.push({ ...item, stem: verdict.revisedStem })
                } else {
                  critiqueStats.dropped++
                  critiqueVerdicts.set(item.stem, { verdict: 'dropped', reason: verdict.reason })
                }
              }

              critiquedItems = survivingItems
              // If critique emptied the batch, count it as a failure to prevent infinite loops
              if (critiquedItems.length === 0) {
                consecutiveFailures++
              }
              console.log(`[pipeline] ${construct.name} batch ${attempts} critique: ${parsed.length} reviewed, ${critiqueStats.dropped} dropped, ${critiqueStats.revised} revised`)
            } else {
              console.warn(`[pipeline] ${construct.name} batch ${attempts}: critique response unparseable, keeping all items`)
              critiqueStats.critiqueFailed = true
            }
          } catch (err) {
            console.warn(`[pipeline] ${construct.name} batch ${attempts}: critique failed (${err instanceof Error ? err.message : 'unknown'}), keeping all items`)
            critiqueStats.critiqueFailed = true
          }
        }

        // Tier 2: Leakage Guard — embed and check items before deduplication
        let leakagePassedItems = critiquedItems
        if (leakageEnabled && critiquedItems.length > 0) {
          const batchStems = critiquedItems.map((item) => item.stem)
          const batchEmbeddings = await embedTexts(batchStems, embeddingModel)

          const passedItems: typeof critiquedItems = []
          for (let i = 0; i < critiquedItems.length; i++) {
            leakageStats.itemsChecked++
            const result = checkItemLeakage(batchEmbeddings[i], construct.id, centroidCache)

            if (result.isLeaking) {
              leakageStats.flagged++
              console.log(`[pipeline] ${construct.name}: item leaked toward ${result.leakageTarget}`)
            } else {
              centroidCache.addItem(construct.id, batchEmbeddings[i])
              passedItems.push(critiquedItems[i])
              // Cache embedding keyed by stem for reuse in bulk embedding step
              stemEmbeddingCache.set(critiquedItems[i].stem, batchEmbeddings[i])
            }
          }

          leakagePassedItems = passedItems
        }

        const constructSeen = seenByConstruct.get(construct.id) ?? new Set<string>(existingNormalized)
        let duplicatesInBatch = 0

        for (const item of leakagePassedItems) {
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

  if (critiqueEnabled) {
    await onProgress('item_critique', 25, { itemsGenerated: rawCandidates.length })
  }

  await onProgress('embedding', 30, { itemsGenerated: rawCandidates.length })

  if (leakageEnabled) {
    await onProgress('leakage_check', 35)
  }

  // Use cached embeddings from leakage guard where available
  const stems = rawCandidates.map(candidate => candidate.stem)
  let fullEmbeddings: number[][]
  if (leakageEnabled) {
    const uncachedIndices: number[] = []
    const uncachedTexts: string[] = []
    for (let i = 0; i < stems.length; i++) {
      if (!stemEmbeddingCache.has(stems[i])) {
        uncachedIndices.push(i)
        uncachedTexts.push(stems[i])
      }
    }
    const newEmbeddings = uncachedTexts.length > 0 ? await embedTexts(uncachedTexts, embeddingModel) : []
    let uncachedIdx = 0
    fullEmbeddings = stems.map((stem) => {
      const cached = stemEmbeddingCache.get(stem)
      if (cached) return cached
      return newEmbeddings[uncachedIdx++]
    })
  } else {
    fullEmbeddings = await embedTexts(stems, embeddingModel)
  }
  const sparseEmbeddings = sparsifyEmbeddings(fullEmbeddings)

  // Tier 2: Difficulty Targeting — compute per-item difficulty estimates
  if (difficultyEnabled) {
    // Seed centroids if not already done by leakage guard
    if (!leakageEnabled) {
      const definitionTexts = constructs.map((c) =>
        [c.name, c.definition ?? '', c.description ?? ''].filter(Boolean).join('. ')
      )
      const definitionEmbeddings = await embedTexts(definitionTexts, embeddingModel)
      constructs.forEach((c, i) => {
        centroidCache.seed(c.id, definitionEmbeddings[i])
      })
    }

    for (let i = 0; i < rawCandidates.length; i++) {
      const centroid = centroidCache.getCentroid(rawCandidates[i].constructId)
      if (centroid && fullEmbeddings[i]) {
        difficultyEstimates.set(i, computeDifficultyEstimate(fullEmbeddings[i], centroid))
      }
    }
  }

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
      critiqueVerdict: critiqueVerdicts.get(candidate.stem)?.verdict,
      critiqueReason: critiqueVerdicts.get(candidate.stem)?.reason,
      critiqueOriginalStem: critiqueVerdicts.get(candidate.stem)?.originalStem,
      leakageScore: undefined,
      leakageTarget: undefined,
      difficultyEstimate: difficultyEstimates.get(index),
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
        pipelineStages: {
          ...(critiqueEnabled ? { critique: critiqueStats } : {}),
          ...(leakageEnabled ? { leakageGuard: leakageStats } : {}),
          ...(difficultyEnabled ? { difficultyTargeting: { enabled: true as const } } : {}),
        },
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
