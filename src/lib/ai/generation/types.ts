/**
 * Generation pipeline internal types.
 *
 * Re-exports types from @/types/generation for pipeline-internal use,
 * and defines pipeline-specific helpers such as the progress callback.
 */

export type {
  GenerationRunConfig,
  GenerationRunStatus,
  ConstructForGeneration,
  PipelineInput,
  PipelineResult,
  CandidateItem,
  ScoredCandidateItem,
  NetworkAnalyzer,
  AdjacencyMatrix,
  CommunityAssignment,
  RedundancyResult,
  StabilityResult,
  PreflightResult,
  ConstructPairResult,
  OpenRouterModel,
} from '@/types/generation'

/**
 * Callback invoked by pipeline steps to report progress.
 *
 * @param step    - Human-readable step name (e.g. "Generating items").
 * @param pct     - Completion percentage for the overall run (0–100).
 * @param details - Optional structured metadata for the step.
 */
export type ProgressCallback = (
  step: string,
  pct: number,
  details?: Record<string, unknown>,
) => Promise<void>
