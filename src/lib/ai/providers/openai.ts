/**
 * OpenAI provider implementation.
 *
 * Uses the official openai SDK package. Requires the OPENAI_API_KEY
 * environment variable to be set.
 */

import OpenAI from 'openai'
import type { AIModelRequest, AIModelResponse, AIProviderType } from '@/types/ai'
import { ProviderRequestError } from '@/types/ai'
import type { AIProvider } from './base'

/** Default model used when not overridden. */
const DEFAULT_MODEL = 'gpt-4o'

/** Default maximum tokens if not provided in the request. */
const DEFAULT_MAX_TOKENS = 4096

export class OpenAIProvider implements AIProvider {
  readonly type: AIProviderType = 'openai'
  readonly name = 'OpenAI'

  private client: OpenAI | null = null

  /** Lazily initialise the SDK client to avoid throwing at import time. */
  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
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
        model: DEFAULT_MODEL,
        messages,
        ...(request.maxTokens !== undefined && { max_tokens: request.maxTokens }),
        ...(request.temperature !== undefined && { temperature: request.temperature }),
        ...(request.responseFormat === 'json' && {
          response_format: { type: 'json_object' as const },
        }),
      })

      const choice = response.choices[0]
      if (!choice) {
        throw new Error('OpenAI returned an empty choices array.')
      }

      return {
        content: choice.message.content ?? '',
        model: response.model,
        provider: 'openai',
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
      }
    } catch (error) {
      if (error instanceof ProviderRequestError) throw error
      throw new ProviderRequestError('openai', error)
    }
  }

  async isAvailable(): Promise<boolean> {
    return typeof process.env.OPENAI_API_KEY === 'string' &&
      process.env.OPENAI_API_KEY.length > 0
  }
}
