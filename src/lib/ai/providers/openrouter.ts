/**
 * OpenRouter provider implementation.
 *
 * OpenRouter exposes an OpenAI-compatible API that routes requests to many
 * upstream models. We reuse the official openai SDK with a custom baseURL.
 * Requires the OpenRouter_API_KEY environment variable to be set.
 */

import OpenAI from 'openai'
import type { AIModelRequest, AIModelResponse, AIProviderType } from '@/types/ai'
import { ProviderRequestError } from '@/types/ai'
import type { AIProvider } from './base'
import type { OpenRouterModel } from '@/types/generation'

/** Default model used when not overridden. */
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5'

/** Default maximum tokens if not provided in the request. */
const DEFAULT_MAX_TOKENS = 4096

/** OpenRouter API base URL. */
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export class OpenRouterProvider implements AIProvider {
  readonly type: AIProviderType = 'custom'
  readonly name = 'OpenRouter'

  private client: OpenAI | null = null

  /** Lazily initialise the SDK client to avoid throwing at import time. */
  private getClient(): OpenAI {
    if (!this.client) {
      if (!process.env.OpenRouter_API_KEY) {
        throw new Error('OpenRouter_API_KEY environment variable is not set')
      }
      this.client = new OpenAI({
        apiKey: process.env.OpenRouter_API_KEY,
        baseURL: OPENROUTER_BASE_URL,
        defaultHeaders: {
          'HTTP-Referer': 'https://talent-fit.app',
          'X-Title': 'Talent Fit',
        },
      })
    }
    return this.client
  }

  async complete(request: AIModelRequest): Promise<AIModelResponse> {
    try {
      const client = this.getClient()

      const messages: OpenAI.ChatCompletionMessageParam[] = []
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt })
      }
      messages.push({ role: 'user', content: request.prompt })

      const response = await client.chat.completions.create({
        model: request.model ?? DEFAULT_MODEL,
        messages,
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(request.temperature !== undefined && { temperature: request.temperature }),
        ...(request.responseFormat === 'json' && {
          response_format: { type: 'json_object' as const },
        }),
      })

      const choice = response.choices[0]
      if (!choice) {
        throw new Error('OpenRouter returned an empty choices array.')
      }

      return {
        content: choice.message.content ?? '',
        model: response.model,
        provider: 'custom',
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
      }
    } catch (error) {
      if (error instanceof ProviderRequestError) throw error
      throw new ProviderRequestError('openrouter', error)
    }
  }

  async isAvailable(): Promise<boolean> {
    return (
      typeof process.env.OpenRouter_API_KEY === 'string' &&
      process.env.OpenRouter_API_KEY.length > 0
    )
  }

  /** Fetch available models from the OpenRouter API. Falls back to FALLBACK_MODELS on error. */
  async listModels(): Promise<OpenRouterModel[]> {
    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
        headers: {
          Authorization: `Bearer ${process.env.OpenRouter_API_KEY}`,
        },
      })
      if (!response.ok) return FALLBACK_MODELS
      const data = await response.json() as { data?: OpenRouterModel[] }
      return data.data ?? FALLBACK_MODELS
    } catch {
      return FALLBACK_MODELS
    }
  }
}

/** Fallback model list used when the OpenRouter API is unavailable. */
export const FALLBACK_MODELS: OpenRouterModel[] = [
  { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
  { id: 'anthropic/claude-haiku-4-5', name: 'Claude Haiku 4.5' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct', name: 'Mistral Small 3.1 24B' },
]

export const openRouterProvider = new OpenRouterProvider()
