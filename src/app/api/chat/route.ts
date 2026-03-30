import OpenAI from 'openai'
import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireAdminScope,
} from '@/lib/auth/authorization'
import { getModelForTask } from '@/lib/ai/model-config'
import { getActiveSystemPrompt } from '@/lib/ai/prompt-config'
import { getOpenRouterErrorMessage, withOpenRouterRetry } from '@/lib/ai/providers/openrouter-retry'

export const runtime = 'nodejs'

export async function POST(request: Request) {
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
    // Resolve the configured model for chat purpose
    const [taskConfig, systemPrompt] = await Promise.all([
      getModelForTask('chat'),
      getActiveSystemPrompt('chat'),
    ])
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
