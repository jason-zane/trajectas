/**
 * Provider registry and factory.
 *
 * Holds all known AI providers and exposes helpers to retrieve, list,
 * and extend them at runtime. Ships with Anthropic and OpenAI pre-registered.
 */

import type { AIProviderType } from '@/types/ai'
import { ProviderNotFoundError } from '@/types/ai'
import type { AIProvider } from './base'
import { AnthropicProvider } from './anthropic'
import { OpenAIProvider } from './openai'

export type { AIProvider } from './base'
export { AnthropicProvider } from './anthropic'
export { OpenAIProvider } from './openai'
export { OpenRouterProvider, openRouterProvider, FALLBACK_MODELS } from './openrouter'

const registry = new Map<AIProviderType, AIProvider>()

// Pre-register built-in providers.
registry.set('anthropic', new AnthropicProvider())
registry.set('openai', new OpenAIProvider())

/** Retrieve a specific provider by type. */
export function getProvider(type: AIProviderType): AIProvider {
  const provider = registry.get(type)
  if (!provider) throw new ProviderNotFoundError(type)
  return provider
}

/** Return the first available provider. */
export async function getDefaultProvider(): Promise<AIProvider> {
  for (const provider of registry.values()) {
    if (await provider.isAvailable()) return provider
  }
  throw new ProviderNotFoundError('default (no provider has a valid API key configured)')
}

/** Register or replace a provider. */
export function registerProvider(provider: AIProvider): void {
  registry.set(provider.type, provider)
}

export interface ProviderInfo {
  type: AIProviderType
  name: string
  available: boolean
}

/** List all registered providers with availability status. */
export async function listProviders(): Promise<ProviderInfo[]> {
  const entries = Array.from(registry.values())
  return Promise.all(
    entries.map(async (p) => ({
      type: p.type,
      name: p.name,
      available: await p.isAvailable(),
    })),
  )
}
