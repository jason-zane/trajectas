/**
 * Talent Fit AI module — public API.
 *
 * This barrel file re-exports everything that consumers of the AI
 * layer need. Internal implementation details (e.g. prompt text,
 * JSON parsing helpers) are intentionally kept private.
 *
 * @example
 * ```ts
 * import {
 *   runMatching,
 *   getProvider,
 *   getDefaultProvider,
 *   registerProvider,
 *   listProviders,
 * } from '@/lib/ai'
 * ```
 */

// Matching engine
export { runMatching } from './matching/engine'
export type { MatchingOptions } from './matching/engine'

// Provider registry & factory
export {
  getProvider,
  getDefaultProvider,
  registerProvider,
  listProviders,
} from './providers'
export type { AIProvider, ProviderInfo } from './providers'

// Concrete providers (useful for direct instantiation or testing)
export { AnthropicProvider } from './providers/anthropic'
export { OpenAIProvider } from './providers/openai'

// Prompt utilities (expose version and builder for advanced use cases)
export {
  buildMatchingPrompt,
  PROMPT_VERSION,
} from './prompts/competency-matching'
