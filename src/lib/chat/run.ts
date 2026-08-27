// =============================================================================
// src/lib/chat/run.ts
//
// The data-mode tool loop. Rounds of non-streaming completions while the model
// keeps asking for tools, then one streamed completion for the prose. Output is
// ndjson so status, structured blocks and text can share a single response body.
//
// Two invariants worth stating because the rest of the design leans on them:
//
//  1. Tools run on the caller's RLS-scoped client. Nothing here injects a
//     tenant predicate, because nothing here needs to.
//  2. A tool that returns nothing produces an explicit failure envelope which
//     is handed to the model verbatim. "No rows" must reach the user as "I
//     couldn't find that", never as an invention.
// =============================================================================

import 'server-only'

import type OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { encodeFrame, type ChatBlock, type ChatFrame, type EntityLink } from './envelope'
import { toOpenAITools, type ChatToolRegistry } from './registry'
import { recordChatToolCall } from './audit'
import { logActionError } from '@/lib/security/action-errors'
import { getOpenRouterErrorMessage, withOpenRouterRetry } from '@/lib/ai/providers/openrouter-retry'

/** Hard ceiling on tool rounds, so a confused model cannot loop forever. */
const MAX_TOOL_ROUNDS = 4

export interface RunDataChatOptions {
  client: OpenAI
  modelId: string
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  registry: ChatToolRegistry
  db: SupabaseClient
  isPlatformAdmin: boolean
  actorProfileId: string | null
  maxTokens: number
  temperature?: number
  signal?: AbortSignal
}

/** Structured payloads a tool result should surface to the browser. */
function blocksFromToolResult(toolName: string, result: unknown): ChatBlock[] {
  if (!result || typeof result !== 'object') return []
  const envelope = result as { ok?: boolean; data?: unknown }
  if (envelope.ok !== true || !envelope.data || typeof envelope.data !== 'object') return []

  const data = envelope.data as Record<string, unknown>
  const collections: Array<{ key: string; title: string }> = [
    { key: 'participants', title: 'Participants' },
    { key: 'campaigns', title: 'Campaigns' },
    { key: 'assessments', title: 'Assessments' },
  ]

  for (const { key, title } of collections) {
    const rows = data[key]
    if (!Array.isArray(rows) || rows.length === 0) continue
    const links: EntityLink[] = rows.flatMap((row) => {
      const r = row as Record<string, unknown>
      const id = (r.participantId ?? r.campaignId ?? r.assessmentId) as string | undefined
      if (!id) return []
      const label = (r.name ?? r.title) as string | null
      return [
        {
          kind:
            key === 'participants'
              ? ('participant' as const)
              : key === 'campaigns'
                ? ('campaign' as const)
                : ('assessment' as const),
          id,
          label: label ?? 'Untitled',
          sublabel: (r.campaignTitle ?? r.clientName ?? null) as string | null,
          href: (r.href ?? null) as string | null,
        },
      ]
    })
    if (links.length > 0) {
      return [{ kind: 'entity_links', v: 1, title, links }]
    }
  }

  void toolName
  return []
}

export function runDataChat(options: RunDataChatOptions): ReadableStream<Uint8Array> {
  const {
    client,
    modelId,
    systemPrompt,
    messages,
    registry,
    db,
    isPlatformAdmin,
    actorProfileId,
    maxTokens,
    temperature,
    signal,
  } = options

  const encoder = new TextEncoder()
  const tools = toOpenAITools(registry)

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (frame: ChatFrame) => {
        controller.enqueue(encoder.encode(encodeFrame(frame)))
      }

      const conversation: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ]

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
          const completion = await withOpenRouterRetry(() =>
            client.chat.completions.create(
              {
                model: modelId,
                messages: conversation,
                tools,
                tool_choice: 'auto',
                max_tokens: maxTokens,
                ...(temperature !== undefined && { temperature }),
              },
              { signal },
            ),
          )

          const choice = completion.choices[0]
          const toolCalls = choice?.message?.tool_calls ?? []

          if (toolCalls.length === 0) {
            // The model answered without (further) tools. Stream that answer.
            conversation.push(choice.message)
            break
          }

          conversation.push(choice.message)

          for (const call of toolCalls) {
            if (call.type !== 'function') continue
            const tool = registry.get(call.function.name)
            const startedAt = Date.now()

            if (!tool) {
              conversation.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify({
                  ok: false,
                  reason: 'unavailable',
                  message: `Unknown tool "${call.function.name}".`,
                }),
              })
              continue
            }

            send({ type: 'status', label: `${tool.statusLabel}…` })

            let payload: unknown
            let outcome: 'ok' | 'failed' = 'ok'
            let reason: string | undefined
            let rowCount: number | null = null

            try {
              const rawArgs = call.function.arguments?.trim()
              const parsedArgs = rawArgs ? JSON.parse(rawArgs) : {}
              const validated = tool.params.safeParse(parsedArgs)
              if (!validated.success) {
                outcome = 'failed'
                reason = 'invalid_input'
                payload = {
                  ok: false,
                  reason: 'invalid_input',
                  message: `Invalid arguments for ${tool.name}: ${validated.error.message}`,
                }
              } else {
                const result = await tool.execute(validated.data, { db, isPlatformAdmin })
                payload = result
                if (result.ok) {
                  const data = result.data as Record<string, unknown> | null
                  const count = data && typeof data === 'object' ? data.matchCount : null
                  rowCount = typeof count === 'number' ? count : null
                  for (const block of blocksFromToolResult(tool.name, result)) {
                    send({ type: 'block', block })
                  }
                } else {
                  outcome = 'failed'
                  reason = result.reason
                }
              }
            } catch (error) {
              logActionError(`chat.tool.${tool.name}`, error)
              outcome = 'failed'
              reason = 'unavailable'
              payload = {
                ok: false,
                reason: 'unavailable',
                message: `${tool.name} failed to run.`,
              }
            }

            void recordChatToolCall({
              actorProfileId,
              tool: tool.name,
              mode: 'data',
              outcome,
              reason,
              rowCount,
              durationMs: Date.now() - startedAt,
            })

            conversation.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(payload),
            })
          }
        }

        // Final pass: stream the prose the model writes around whatever the
        // tools returned. Tools are withheld here so this call always
        // terminates in text rather than another round of calls.
        const stream = await withOpenRouterRetry(() =>
          client.chat.completions.create(
            {
              model: modelId,
              messages: conversation,
              max_tokens: maxTokens,
              ...(temperature !== undefined && { temperature }),
              stream: true,
            },
            { signal },
          ),
        )

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) send({ type: 'text', delta })
        }

        controller.close()
      } catch (error) {
        logActionError('chat.data.run', error)
        send({ type: 'error', message: getOpenRouterErrorMessage(error) })
        controller.close()
      }
    },
  })
}
