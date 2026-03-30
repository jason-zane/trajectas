/**
 * Generation pipeline — public API.
 */

export { runMockPipeline } from './pipeline-mock'
export type { MockPipelineResult } from './pipeline-mock'
export type { ProgressCallback } from './types'
export { runPipeline } from './pipeline'
export { embedTexts, embedText } from './embeddings'
export { runConstructPreflight } from './construct-preflight'
