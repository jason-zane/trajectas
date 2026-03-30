import OpenAI from 'openai'
import { getModelForTask } from '@/lib/ai/model-config'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `You are a helpful AI assistant for TalentFit, an assessment and psychometric platform. You can help with questions about organisational psychology, psychometric assessment design, competency frameworks, and general queries. Be concise and professional.`

export async function POST(request: Request) {
  const { messages, model: modelOverride } = await request.json() as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    model?: string
  }

  if (!messages?.length) {
    return new Response('Messages are required', { status: 400 })
  }

  const apiKey = process.env.OpenRouter_API_KEY
  if (!apiKey) {
    return new Response('OpenRouter API key is not configured', { status: 500 })
  }

  // Resolve the configured model for chat purpose
  const taskConfig = await getModelForTask('chat')
  const modelId = modelOverride || taskConfig.modelId

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://talent-fit.app',
      'X-Title': 'Talent Fit',
    },
  })

  const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  try {
    const stream = await client.chat.completions.create({
      model: modelId,
      messages: chatMessages,
      max_tokens: taskConfig.config.max_tokens ?? 4096,
      ...(taskConfig.config.temperature !== undefined && {
        temperature: taskConfig.config.temperature,
      }),
      stream: true,
    })

    // Convert the OpenAI stream to a ReadableStream of text chunks
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content
            if (text) {
              controller.enqueue(encoder.encode(text))
            }
          }
          controller.close()
        } catch (error) {
          // Mid-stream provider error — write it as text so the client sees it
          const err = error as { error?: { message?: string; metadata?: { raw?: string } }; message?: string }
          const msg = err.error?.metadata?.raw || err.error?.message || err.message || 'Provider error during streaming'
          controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    // Surface OpenRouter errors to the client instead of a generic 500
    const status = (error as { status?: number }).status ?? 500
    const metadata = (error as { error?: { message?: string; metadata?: { raw?: string } } }).error
    const message = metadata?.metadata?.raw || metadata?.message || 'An error occurred'
    return new Response(message, { status })
  }
}
