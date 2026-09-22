/**
 * TypeSafe Jev decision client.
 *
 * Deliberately NOT registered in the provider registry: Jev is not a
 * completion provider. It answers a map of independent questions about a
 * piece of state and returns calibrated probabilities, so it has its own
 * request/response shape and its own error handling.
 *
 * The endpoint is alpha, hence the short per-attempt timeout and the small
 * retry budget — a Jev call is the hot path of a user-facing build, and a
 * hung request costs more than a fallback to the LLM engine.
 */

import { z } from 'zod'
import { ProviderRequestError } from '@/types/ai'
import { getOpenRouterErrorMessage, withOpenRouterRetry } from './openrouter-retry'

/** OpenRouter's alpha decisions endpoint. */
export const JEV_DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions'

const DEFAULT_TIMEOUT_MS = 12_000
const DEFAULT_MAX_ATTEMPTS = 2
/** How much of an error body to keep in the thrown message. */
const ERROR_BODY_LIMIT = 300

/** One question put to the decision model. Questions are judged independently. */
export type JevQuestion =
  | {
      type: 'score'
      instructions: string
      /** 2–10 ordered levels, worst first. The answer is a weighted 0..(n-1) value. */
      criteria: string[]
    }
  | {
      type: 'choice'
      instructions: string
      /** Key → description. The answer is one of the keys. */
      criteria: Record<string, string>
    }
  | {
      type: 'noul'
      instructions: string
      criteria: { true: string; false: string }
    }

export interface JevRequest {
  /** Jev model id, e.g. "typesafe/jev-1.13". */
  model: string
  /** Arbitrary JSON the questions are judged against. */
  state: unknown
  /** Question key → question. Keys come back verbatim in `answers`. */
  questions: Record<string, JevQuestion>
}

export type JevAnswer =
  | {
      type: 'score'
      /** Probability-weighted value on the 0..(criteria.length - 1) scale. */
      score: number
      /** Per-level probability, keyed by level index as a string ("0".."n-1"). */
      probabilities?: Record<string, number>
      /** Level index → criterion text, as echoed by the endpoint. */
      legend?: Record<string, string>
      confidence?: number
    }
  | {
      type: 'choice'
      choice: string
      probabilities?: Record<string, number>
      confidence?: number
    }
  | {
      type: 'noul'
      /** Probability of "true" (0–1). Older payloads sent a boolean. */
      noul: number | boolean
      probabilities?: unknown
      confidence?: number
    }

export interface JevResponse {
  /** The resolved model id, e.g. "typesafe/jev-1.13-20260917". */
  model: string
  answers: Record<string, JevAnswer>
  usage: { inputTokens: number; outputTokens: number; cost?: number }
  id?: string
}

export interface JevDecideOptions {
  /** Per-attempt timeout. Default 12 s. */
  timeoutMs?: number
  /** Total attempts including the first. Default 2. */
  maxAttempts?: number
  /** Injectable fetch — tests only. */
  fetchImpl?: typeof fetch
}

const answerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('score'),
    score: z.number(),
    probabilities: z.record(z.string(), z.number()).optional(),
    legend: z.record(z.string(), z.string()).optional(),
    confidence: z.number().optional(),
  }),
  z.object({
    type: z.literal('choice'),
    choice: z.string(),
    probabilities: z.record(z.string(), z.number()).optional(),
    confidence: z.number().optional(),
  }),
  z.object({
    type: z.literal('noul'),
    noul: z.union([z.number(), z.boolean()]),
    probabilities: z.unknown().optional(),
    confidence: z.number().optional(),
  }),
])

const responseSchema = z.object({
  model: z.string(),
  answers: z.record(z.string(), answerSchema),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      cost: z.number().optional(),
    })
    .optional(),
  id: z.string().optional(),
})

/** Shape thrown inside the retry loop so `isRetryableOpenRouterError` can read it. */
type JevTransportError = { status: number; message: string }

function isAbortError(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'AbortError'
}

/**
 * Ask Jev a batch of questions about one piece of state.
 *
 * Never logs the request body — `state` carries third-party position
 * descriptions.
 */
export async function decide(
  request: JevRequest,
  options: JevDecideOptions = {},
): Promise<JevResponse> {
  const apiKey = process.env.OpenRouter_API_KEY
  if (!apiKey) {
    throw new Error('OpenRouter_API_KEY environment variable is not set')
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const fetchImpl = options.fetchImpl ?? fetch

  try {
    const payload = await withOpenRouterRetry(
      async () => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        try {
          const res = await fetchImpl(JEV_DECISIONS_URL, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'HTTP-Referer': 'https://trajectas.com',
              'X-Title': 'Trajectas',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: request.model,
              state: request.state,
              questions: request.questions,
            }),
            signal: controller.signal,
          })

          if (!res.ok) {
            const body = await res.text().catch(() => '')
            const httpError: JevTransportError = {
              status: res.status,
              message: `Jev request failed (${res.status}): ${body.slice(0, ERROR_BODY_LIMIT)}`,
            }
            throw httpError
          }

          return (await res.json()) as unknown
        } catch (error) {
          // Timeouts and network failures have to look like a 5xx or the
          // retry helper drops them on the first attempt.
          if (isAbortError(error)) {
            const timeoutError: JevTransportError = {
              status: 503,
              message: 'Jev request timed out',
            }
            throw timeoutError
          }
          if (error instanceof TypeError) {
            const networkError: JevTransportError = { status: 503, message: error.message }
            throw networkError
          }
          throw error
        } finally {
          clearTimeout(timer)
        }
      },
      { maxAttempts },
    )

    const parsed = responseSchema.safeParse(payload)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const where = issue ? ` (${issue.path.join('.') || 'root'}: ${issue.message})` : ''
      throw new ProviderRequestError('jev', `Jev returned a response in an unexpected shape${where}`)
    }
    if (Object.keys(parsed.data.answers).length === 0) {
      throw new ProviderRequestError('jev', 'Jev returned no answers')
    }

    const usage = parsed.data.usage
    return {
      model: parsed.data.model,
      answers: parsed.data.answers,
      usage: {
        inputTokens: usage?.input_tokens ?? 0,
        outputTokens: usage?.output_tokens ?? 0,
        ...(usage?.cost !== undefined ? { cost: usage.cost } : {}),
      },
      ...(parsed.data.id !== undefined ? { id: parsed.data.id } : {}),
    }
  } catch (error) {
    if (error instanceof ProviderRequestError) throw error
    throw new ProviderRequestError('jev', getOpenRouterErrorMessage(error))
  }
}
