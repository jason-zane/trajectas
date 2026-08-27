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
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { checkKeyedRateLimit } from '@/lib/security/rate-limit'
import { chatToolRegistry } from '@/lib/chat/tools'
import type { ChatBlock } from '@/lib/chat/envelope'
import { runDataChat } from '@/lib/chat/run'
import { isToolCapableModel, toolModelRejectionMessage } from '@/lib/chat/models'
import {
  parseJsonRequestWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'
import { logActionError } from '@/lib/security/action-errors'

export const runtime = 'nodejs'
export const maxDuration = 300

const MAX_CHAT_BODY_BYTES = 256 * 1024

/** Data mode is far more expensive per question than general chat. */
const DATA_MODE_LIMIT = 30
const DATA_MODE_WINDOW_MS = 5 * 60 * 1000

type ChatMode = 'general' | 'data'

/**
 * Data mode has its own model row so a tool-capable model can be pinned
 * independently of general chat. Fall back to the general chat model if that
 * row is missing — the tool-capability guard below still refuses if the
 * fallback cannot call tools.
 */
async function resolveChatModel(mode: ChatMode) {
  if (mode !== 'data') return getModelForTask('chat')
  try {
    return await getModelForTask('chat_data')
  } catch {
    return getModelForTask('chat')
  }
}

export async function POST(request: Request) {
  let scope
  try {
    scope = await requireAdminScope()
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return new Response('Authentication is required', { status: 401 })
    }

    if (error instanceof AuthorizationError) {
      return new Response(error.message, { status: 403 })
    }

    throw error
  }

  let body: {
    messages: Array<{
      role: 'user' | 'assistant'
      content: string
      blocks?: ChatBlock[]
    }>
    model?: string
    mode?: ChatMode
  }
  try {
    body = await parseJsonRequestWithLimit(request, MAX_CHAT_BODY_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return new Response('Request body too large', { status: 413 })
    }

    return new Response('Request body must be valid JSON', { status: 400 })
  }

  const { messages, model: modelOverride } = body
  const mode: ChatMode = body.mode === 'data' ? 'data' : 'general'

  if (!messages?.length) {
    return new Response('Messages are required', { status: 400 })
  }

  const apiKey = process.env.OpenRouter_API_KEY
  if (!apiKey) {
    return new Response('OpenRouter API key is not configured', { status: 500 })
  }

  const actorProfileId = scope.actor?.id ?? null

  if (mode === 'data') {
    const limit = await checkKeyedRateLimit(
      `chat:data:${actorProfileId ?? 'anonymous'}`,
      DATA_MODE_LIMIT,
      DATA_MODE_WINDOW_MS,
    )
    if (limit && !limit.allowed) {
      return new Response(
        'Too many data questions in a short period. Try again shortly.',
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSeconds || 60) },
        },
      )
    }
  }

  try {
    const [taskConfig, systemPrompt, allowedModels] = await Promise.all([
      resolveChatModel(mode),
      getActiveSystemPrompt(mode === 'data' ? 'chat_data' : 'chat'),
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

    // A model that silently ignores `tools` answers from its own weights —
    // exactly the ungrounded behaviour data mode exists to remove. Refuse
    // rather than degrade.
    if (mode === 'data' && !isToolCapableModel(modelId)) {
      return new Response(toolModelRejectionMessage(modelId), { status: 400 })
    }

    const client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://trajectas.com',
        'X-Title': 'Trajectas',
      },
    })

    const maxTokens = taskConfig.config.max_tokens ?? 4096

    if (mode === 'data') {
      const db = await createServerSupabaseClient()
      const readable = runDataChat({
        client,
        modelId,
        systemPrompt: systemPrompt.content,
        messages,
        registry: chatToolRegistry,
        db,
        isPlatformAdmin: scope.isPlatformAdmin,
        actorProfileId,
        maxTokens,
        temperature: taskConfig.config.temperature,
        signal: request.signal,
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'private, no-store',
        },
      })
    }

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
        max_tokens: maxTokens,
        ...(taskConfig.config.temperature !== undefined && {
          temperature: taskConfig.config.temperature,
        }),
        stream: true,
      })
    )

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
          logActionError('api.chat.stream', error)
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
    const status = (error as { status?: number }).status ?? 500
    const message = getOpenRouterErrorMessage(error)
    return new Response(message, { status })
  }
}
