/**
 * Anthropic (Claude) provider implementation.
 *
 * Uses the official @anthropic-ai/sdk package. Requires the
 * ANTHROPIC_API_KEY environment variable to be set.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { AIModelRequest, AIModelResponse, AIProviderType } from '@/types/ai'
import { ProviderRequestError } from '@/types/ai'
import type { AIProvider } from './base'

/** Default model used when not overridden. */
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250514'

/** Default maximum tokens if not provided in the request. */
const DEFAULT_MAX_TOKENS = 4096

export class AnthropicProvider implements AIProvider {
  readonly type: AIProviderType = 'anthropic'
  readonly name = 'Anthropic Claude'

  private client: Anthropic | null = null

  /** Lazily initialise the SDK client to avoid throwing at import time. */
  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    }
    return this.client
  }

  async complete(request: AIModelRequest): Promise<AIModelResponse> {
    try {
      const client = this.getClient()

      const response = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(request.temperature !== undefined && { temperature: request.temperature }),
        ...(request.systemPrompt && { system: request.systemPrompt }),
        messages: [{ role: 'user', content: request.prompt }],
      })

      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')

      return {
        content: textContent,
        model: response.model,
        provider: 'anthropic',
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      }
    } catch (error) {
      if (error instanceof ProviderRequestError) throw error
      throw new ProviderRequestError('anthropic', error)
    }
  }

  async isAvailable(): Promise<boolean> {
    return typeof process.env.ANTHROPIC_API_KEY === 'string' &&
      process.env.ANTHROPIC_API_KEY.length > 0
  }
}
