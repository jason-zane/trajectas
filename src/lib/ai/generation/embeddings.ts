/**
 * embeddings.ts
 *
 * Embeds arrays of text via OpenRouter using text-embedding-3-small.
 * Returns a float array per input text (1536 dimensions).
 */
import OpenAI from 'openai'

const EMBEDDING_MODEL = 'openai/text-embedding-3-small'
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const BATCH_SIZE = 100   // OpenRouter limit per request

function getEmbeddingClient(): OpenAI {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set')
  }
  return new OpenAI({
    apiKey:         process.env.OPENROUTER_API_KEY,
    baseURL:        OPENROUTER_BASE_URL,
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
  model = EMBEDDING_MODEL,
): Promise<number[][]> {
  if (texts.length === 0) return []

  const client = getEmbeddingClient()
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const response = await client.embeddings.create({
      model,
      input: batch,
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
export async function embedText(text: string, model = EMBEDDING_MODEL): Promise<number[]> {
  const results = await embedTexts([text], model)
  return results[0] ?? []
}
