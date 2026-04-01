// =============================================================================
// generation.ts — Types for the AI-GENIE item generation pipeline
// =============================================================================

import type {
  ConstructConfigOverride,
  GenerationRunConfig,
  GenerationRunStatus,
} from './database'

// Re-export for convenience
export type { GenerationRunConfig, GenerationRunStatus }
export type { ConstructConfigOverride }

// ---------------------------------------------------------------------------
// Pipeline types
// ---------------------------------------------------------------------------

/** Input to the generation pipeline. */
export interface PipelineInput {
  runId: string
  config: GenerationRunConfig
  constructs: ConstructForGeneration[]
}

/** Parent factor context injected for criterion linkage during construct-level generation. */
export interface ParentFactorContext {
  name: string
  definition?: string
  indicatorsHigh?: string
}

/** Construct data assembled for use in generation prompts. */
export interface ConstructForGeneration {
  id: string
  name: string
  slug: string
  definition?: string
  description?: string
  indicatorsLow?: string
  indicatorsMid?: string
  indicatorsHigh?: string
  existingItemCount: number
  existingItems?: string[]
  parentFactors?: ParentFactorContext[]
}

export interface ConstructDraftInput extends ConstructConfigOverride {
  id: string
  name: string
}

export type NetworkEstimator = 'tmfg' | 'ebicglasso'
export type EmbeddingType = 'full' | 'sparse'
export type RemovalStage = 'uva' | 'boot_ega' | 'kept'

/** Result of the full pipeline run. */
export interface PipelineResult {
  runId: string
  itemsGenerated: number
  itemsAfterUva: number
  itemsAfterBoot: number
  nmiInitial: number
  nmiFinal?: number
  modelUsed: string
  aiSnapshot?: {
    models?: Record<string, string>
    prompts?: Record<string, { id: string; version: number }>
    preflight?: {
      similarityThreshold: number
      pairCount: number
      llmPairCount: number
    }
    embeddingType?: EmbeddingType
    networkEstimator?: NetworkEstimator
    walktrapStep?: number
    nmiByStage?: Partial<Record<'initial' | 'postEmbeddingSelection' | 'postUva' | 'postBoot' | 'final', number>>
    uvaSweeps?: number
    bootSweeps?: number
  }
  tokenUsage: { inputTokens: number; outputTokens: number }
}

/** A single candidate item produced by the LLM. */
export interface CandidateItem {
  stem: string
  reverseScored: boolean
  rationale: string
  constructId: string
  difficultyTier?: 'easy' | 'moderate' | 'hard' | 'foundation' | 'applied' | 'demanding'
  sdRisk?: 'low' | 'moderate' | 'high'
  facet?: string
}

/** A candidate item with computed psychometric metrics. */
export interface ScoredCandidateItem extends CandidateItem {
  embedding: number[]
  communityId?: number
  initialCommunityId?: number
  finalCommunityId?: number
  wtoMax?: number
  bootStability?: number
  removalStage?: RemovalStage
  removalSweep?: number
  isRedundant: boolean
  isUnstable: boolean
}

// ---------------------------------------------------------------------------
// Network analysis types
// ---------------------------------------------------------------------------

/** Adjacency matrix for the item network. */
export type AdjacencyMatrix = number[][]

/** Community assignment for a single item. */
export interface CommunityAssignment {
  itemIndex: number
  communityId: number
  stability: number
}

/** Result of redundancy analysis. */
export interface RedundancyResult {
  redundantIndices: Set<number>
  wtoScores: number[]
  removalSweepByIndex?: Map<number, number>
  sweepCount?: number
}

/** Result of bootstrap stability analysis. */
export interface StabilityResult {
  stabilityScores: number[]
  unstableIndices: Set<number>
  removalSweepByIndex?: Map<number, number>
}

/** Interface for network analysis algorithms — swap TypeScript for R/Python later. */
export interface NetworkAnalyzer {
  buildNetwork(correlationMatrix: number[][], estimator?: NetworkEstimator): AdjacencyMatrix
  detectCommunities(adjacency: AdjacencyMatrix, walktrapStep?: number): CommunityAssignment[]
  computeNMI(predicted: number[], actual: number[]): number
  findRedundantItems(adjacency: AdjacencyMatrix, cutoff: number): RedundancyResult
  bootstrapStability(
    embeddings: number[][],
    originalCommunities: number[],
    estimator: NetworkEstimator,
    walktrapStep: number,
    nBootstraps: number,
    cutoff: number,
  ): StabilityResult
}

// ---------------------------------------------------------------------------
// Pre-flight types
// ---------------------------------------------------------------------------

/** Result of pre-flight construct similarity analysis. */
export interface PreflightResult {
  pairs: ConstructPairResult[]
  overallStatus: 'green' | 'amber' | 'red'
  metadata?: PreflightMetadata
}

export interface PreflightMetadata {
  similarityThreshold: number
  reviewThreshold?: number
  pairCount: number
  llmPairCount: number
  topPairsReviewed?: number
  embeddingModel: string
  preflightModel?: string
  promptVersion?: number
}

/** Similarity analysis result for a pair of constructs. */
export interface ConstructPairResult {
  constructAId: string
  constructAName: string
  constructBId: string
  constructBName: string
  cosineSimilarity: number
  status: 'green' | 'amber' | 'red'
  reviewedByLlm?: boolean
  overlapSummary?: string
  sharedSignals?: string[]
  uniqueSignalsA?: string[]
  uniqueSignalsB?: string[]
  discriminatingItemsA?: string[]
  discriminatingItemsB?: string[]
  refinementGuidanceA?: string
  refinementGuidanceB?: string
  llmExplanation?: string
  bigFiveMappingA?: BigFiveMapping
  bigFiveMappingB?: BigFiveMapping
}

/** Big Five domain mapping for a construct, returned by preflight analysis. */
export interface BigFiveMapping {
  primaryDomain: string
  knownFacetMatch?: string | null
  intersectionDomains?: string[]
  note?: string
}

// ---------------------------------------------------------------------------
// OpenRouter model list
// ---------------------------------------------------------------------------

/** A model entry from the OpenRouter /api/v1/models endpoint. */
export interface OpenRouterModel {
  id: string
  name: string
  description?: string
  pricing?: {
    prompt: string
    completion: string
  }
  context_length?: number
  architecture?: {
    modality?: string
    input_modalities?: string[]
    output_modalities?: string[]
    tokenizer?: string
  }
}
