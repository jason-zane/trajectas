// =============================================================================
// src/lib/chat/models.ts
//
// Data mode drives an OpenAI-style tool-calling loop, and not every model
// reachable through OpenRouter implements tool calls. A model that ignores the
// `tools` argument does not fail loudly — it answers from its own weights,
// which is precisely the ungrounded behaviour this feature exists to remove.
// So data mode validates the resolved model up front and refuses rather than
// silently degrading into confident fiction.
// =============================================================================

import 'server-only'

/**
 * Model id prefixes known to implement OpenAI-compatible tool calling through
 * OpenRouter. Prefix matching keeps dated/versioned suffixes working
 * (e.g. `anthropic/claude-sonnet-4-5` and `...-4-5-20250930`).
 */
const TOOL_CAPABLE_PREFIXES = [
  'anthropic/claude',
  'openai/gpt-4',
  'openai/gpt-5',
  'openai/o1',
  'openai/o3',
  'openai/o4',
  'google/gemini',
  'mistralai/mistral-large',
  'mistralai/mistral-small',
  'meta-llama/llama-3.3',
  'meta-llama/llama-4',
  'deepseek/deepseek-chat',
  'x-ai/grok',
  'qwen/qwen3',
] as const

export function isToolCapableModel(modelId: string): boolean {
  const id = modelId.trim().toLowerCase()
  return TOOL_CAPABLE_PREFIXES.some((prefix) => id.startsWith(prefix))
}

/** Suggested default when the configured chat model cannot call tools. */
export const SUGGESTED_TOOL_MODEL = 'anthropic/claude-sonnet-4-5'

export function toolModelRejectionMessage(modelId: string): string {
  return (
    `The model configured for data mode (${modelId}) does not support tool calling, ` +
    `so it cannot read your data. Choose a tool-capable model — ${SUGGESTED_TOOL_MODEL} ` +
    `is a good default — in Settings → Models, or pick one from the model selector.`
  )
}
