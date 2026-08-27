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

/**
 * Replayed history comes from the client, so bound how much of it is folded
 * back into the prompt regardless of what was posted.
 */
const MAX_REPLAYED_BLOCKS = 4
const MAX_REPLAYED_LINKS = 20

export interface RunDataChatOptions {
  client: OpenAI
  modelId: string
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string; blocks?: ChatBlock[] }>
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

/**
 * A compact, machine-readable transcript of the cards a previous turn showed,
 * so the model can resolve follow-up references to them by id. Kept terse
 * because it is replayed on every subsequent request.
 */
function describeBlocks(blocks: ChatBlock[]): string {
  const lines: string[] = []
  for (const block of blocks.slice(0, MAX_REPLAYED_BLOCKS)) {
    if (block.kind !== 'entity_links') continue
    lines.push(`[${block.title} shown to the user]`)
    block.links.slice(0, MAX_REPLAYED_LINKS).forEach((link, i) => {
      const suffix = link.sublabel ? ` — ${link.sublabel}` : ''
      lines.push(`${i + 1}. ${link.label} (${link.kind} id: ${link.id})${suffix}`)
    })
  }
  return lines.join('\n')
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
        ...messages.map((m) => ({
          role: m.role,
          // Cards are rendered client-side, so replaying only the prose would
          // drop every id the user might refer back to ("the second campaign").
          // Fold a compact transcript of what they saw back into history.
          content:
            m.role === 'assistant' && m.blocks?.length
              ? `${m.content}\n\n${describeBlocks(m.blocks)}`
              : m.content,
        })),
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
            // This completion IS the answer — emit it. Pushing it and asking
            // for another completion would discard it and prompt the model to
            // continue past its own reply, which produces empty or unrelated
            // text on every normal round (ambiguity questions and refusals
            // included).
            const answer = choice?.message?.content ?? ''
            if (answer) send({ type: 'text', delta: answer })
            controller.close()
            return
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

        // Only reached when MAX_TOOL_ROUNDS is exhausted while the model was
        // still asking for tools. Withhold tools so this pass must terminate
        // in text rather than another round of calls.
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
