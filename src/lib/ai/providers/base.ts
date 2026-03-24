/**
 * Abstract base provider interface for the Talent Fit AI abstraction layer.
 *
 * Every AI provider (Anthropic, OpenAI, custom) must implement this
 * interface so the rest of the system can interact with it without
 * knowing the underlying SDK details.
 */

import { AIModelRequest, AIModelResponse, AIProviderType } from '@/types/ai'

export interface AIProvider {
  /** Discriminator identifying which provider type this is. */
  readonly type: AIProviderType

  /** Human-readable provider name (e.g. "Anthropic Claude"). */
  readonly name: string

  /**
   * Send a completion request and return the model's response.
   *
   * Implementations MUST:
   * - Map the provider-agnostic request to the SDK-specific format.
   * - Map the SDK-specific response back to {@link AIModelResponse}.
   * - Throw {@link ProviderRequestError} on failure rather than
   *   leaking SDK-specific exceptions.
   */
  complete(request: AIModelRequest): Promise<AIModelResponse>

  /**
   * Check whether this provider can currently serve requests.
   *
   * Typical checks include verifying that the required API key
   * environment variable is set. Implementations may optionally
   * ping the provider's health endpoint.
   */
  isAvailable(): Promise<boolean>
}
