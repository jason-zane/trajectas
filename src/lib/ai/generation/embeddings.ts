/**
 * embeddings.ts
 *
 * Embeds arrays of text via OpenRouter.
 * Returns a float array per input text.
 */
import OpenAI from 'openai'
import { getModelForTask } from '@/lib/ai/model-config'
import { getOpenRouterErrorMessage, withOpenRouterRetry } from '@/lib/ai/providers/openrouter-retry'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const BATCH_SIZE = 100   // OpenRouter limit per request

function getEmbeddingClient(): OpenAI {
  if (!process.env.OpenRouter_API_KEY) {
    throw new Error('OpenRouter_API_KEY is not set')
  }
  return new OpenAI({
    apiKey:         process.env.OpenRouter_API_KEY,
    baseURL:        OPENROUTER_BASE_URL,
    timeout:        60_000, // 1 min — embedding calls are fast, fail early
    defaultHeaders: {
      'HTTP-Referer': 'https://talent-fit.app',
      'X-Title':      'Talent Fit',
    },
  })
}

/**
 * Embed an array of texts. Returns a float[] per text.
 * Processes in batches of BATCH_SIZE to stay within API limits.
 */
export async function embedTexts(
  texts: string[],
  model?: string,
): Promise<number[][]> {
  if (texts.length === 0) return []

  const resolvedModel = model ?? (await getModelForTask('embedding')).modelId
  const client = getEmbeddingClient()
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const response = await withOpenRouterRetry(() =>
      client.embeddings.create({
        model: resolvedModel,
        input: batch,
      })
    ).catch((error) => {
      throw new Error(`Embedding request failed: ${getOpenRouterErrorMessage(error)}`)
    })
    // OpenAI SDK returns embeddings sorted by index
    const batchEmbeddings = response.data
      .sort((a, b) => a.index - b.index)
      .map(d => d.embedding)
    results.push(...batchEmbeddings)
  }

  return results
}

/**
 * Embed a single text string.
 */
export async function embedText(text: string, model?: string): Promise<number[]> {
  const results = await embedTexts([text], model)
  return results[0] ?? []
}
