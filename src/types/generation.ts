// =============================================================================
// generation.ts — Types for the AI-GENIE item generation pipeline
// =============================================================================

import type { GenerationRunConfig, GenerationRunStatus } from './database'

// Re-export for convenience
export type { GenerationRunConfig, GenerationRunStatus }

// ---------------------------------------------------------------------------
// Pipeline types
// ---------------------------------------------------------------------------

/** Input to the generation pipeline. */
export interface PipelineInput {
  runId: string
  config: GenerationRunConfig
  constructs: ConstructForGeneration[]
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
}

/** Result of the full pipeline run. */
export interface PipelineResult {
  runId: string
  itemsGenerated: number
  itemsAfterUva: number
  itemsAfterBoot: number
  nmiInitial: number
  nmiFinal: number
  modelUsed: string
  tokenUsage: { inputTokens: number; outputTokens: number }
}

/** A single candidate item produced by the LLM. */
export interface CandidateItem {
  stem: string
  reverseScored: boolean
  rationale: string
  constructId: string
}

/** A candidate item with computed psychometric metrics. */
export interface ScoredCandidateItem extends CandidateItem {
  embedding: number[]
  communityId?: number
  wtoMax?: number
  bootStability?: number
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
}

/** Result of bootstrap stability analysis. */
export interface StabilityResult {
  stabilityScores: number[]
  unstableIndices: Set<number>
}

/** Interface for network analysis algorithms — swap TypeScript for R/Python later. */
export interface NetworkAnalyzer {
  buildNetwork(correlationMatrix: number[][]): AdjacencyMatrix
  detectCommunities(adjacency: AdjacencyMatrix): CommunityAssignment[]
  computeNMI(predicted: number[], actual: number[]): number
  findRedundantItems(adjacency: AdjacencyMatrix, cutoff: number): RedundancyResult
  bootstrapStability(
    embeddings: number[][],
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
}

/** Similarity analysis result for a pair of constructs. */
export interface ConstructPairResult {
  constructAId: string
  constructAName: string
  constructBId: string
  constructBName: string
  cosineSimilarity: number
  status: 'green' | 'amber' | 'red'
  discriminatingItemsA?: string[]
  discriminatingItemsB?: string[]
  llmExplanation?: string
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
}
