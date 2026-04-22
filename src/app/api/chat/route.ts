import OpenAI from 'openai'
import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireAdminScope,
} from '@/lib/auth/authorization'
import { getModelForTask } from '@/lib/ai/model-config'
import { getActiveSystemPrompt } from '@/lib/ai/prompt-config'
import { openRouterProvider } from '@/lib/ai/providers/openrouter'
import { getOpenRouterErrorMessage, withOpenRouterRetry } from '@/lib/ai/providers/openrouter-retry'

export const runtime = 'nodejs'

const MAX_CHAT_BODY_BYTES = 256 * 1024

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_CHAT_BODY_BYTES) {
    return new Response('Request body too large', { status: 413 })
  }

  try {
    await requireAdminScope()
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return new Response('Authentication is required', { status: 401 })
    }

    if (error instanceof AuthorizationError) {
      return new Response(error.message, { status: 403 })
    }

    throw error
  }

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

  try {
    // Resolve the configured model for chat purpose.
    // A caller-supplied model is only accepted if it's in the OpenRouter
    // allowlist — prevents arbitrary model injection (cost amplification,
    // safety-filter bypass).
    const [taskConfig, systemPrompt, allowedModels] = await Promise.all([
      getModelForTask('chat'),
      getActiveSystemPrompt('chat'),
      openRouterProvider.listModels('text'),
    ])

    let modelId = taskConfig.modelId
    if (modelOverride) {
      const isAllowed = allowedModels.some((m) => m.id === modelOverride)
      if (!isAllowed) {
        return new Response('Requested model is not available', { status: 400 })
      }
      modelId = modelOverride
    }

    const client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://trajectas.com',
        'X-Title': 'Trajectas',
      },
    })

    const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt.content },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    const stream = await withOpenRouterRetry(() =>
      client.chat.completions.create({
        model: modelId,
        messages: chatMessages,
        max_tokens: taskConfig.config.max_tokens ?? 4096,
        ...(taskConfig.config.temperature !== undefined && {
          temperature: taskConfig.config.temperature,
        }),
        stream: true,
      })
    )

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
          const msg = getOpenRouterErrorMessage(error)
          controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    // Surface OpenRouter errors to the client instead of a generic 500
    const status = (error as { status?: number }).status ?? 500
    const message = getOpenRouterErrorMessage(error)
    return new Response(message, { status })
  }
}
