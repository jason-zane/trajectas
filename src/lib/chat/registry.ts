// =============================================================================
// src/lib/chat/registry.ts
//
// The tool registry. A chat tool is a named, zod-validated function over the
// REQUESTING USER'S Supabase client — never the admin client. Tenancy is not a
// parameter and not a predicate the tool author has to remember: it comes from
// the RLS policies attached to that connection, so the same tool body answers
// broadly for a platform admin and narrowly for a client member.
//
// tests/architecture/chat-rls-client.test.ts fails CI if anything under
// src/lib/chat/ imports the admin client (src/lib/chat/audit.ts is the single
// allow-listed exception, and it only writes).
// =============================================================================

import 'server-only'

import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type OpenAI from 'openai'
import type { ToolEnvelope } from './envelope'

/** What a tool may do with the request beyond querying. */
export interface ChatToolContext {
  /** The requester's RLS-scoped client. Tenancy comes from its JWT. */
  db: SupabaseClient
  /** True only for platform admins — used for data-source policy, not access. */
  isPlatformAdmin: boolean
}

export interface ChatTool<TParams extends z.ZodTypeAny = z.ZodTypeAny, TData = unknown> {
  name: string
  /** Shown to the model. Say what it answers, not how it works. */
  description: string
  params: TParams
  /** Progress label streamed while this runs, e.g. "Searching participants". */
  statusLabel: string
  execute: (
    args: z.infer<TParams>,
    ctx: ChatToolContext,
  ) => Promise<ToolEnvelope<TData>>
}

export function defineChatTool<TParams extends z.ZodTypeAny, TData>(
  tool: ChatTool<TParams, TData>,
): ChatTool<TParams, TData> {
  return tool
}

/** Registry lookup keyed by tool name. */
export type ChatToolRegistry = Map<string, ChatTool>

export function buildRegistry(tools: ChatTool[]): ChatToolRegistry {
  const map: ChatToolRegistry = new Map()
  for (const tool of tools) {
    if (map.has(tool.name)) {
      throw new Error(`Duplicate chat tool name: ${tool.name}`)
    }
    map.set(tool.name, tool)
  }
  return map
}

/**
 * Convert the registry into OpenAI function-tool definitions. zod v4 ships
 * `z.toJSONSchema`, so the schema the model sees and the schema that validates
 * the call it makes are the same object — they cannot drift.
 */
export function toOpenAITools(registry: ChatToolRegistry): OpenAI.ChatCompletionTool[] {
  return Array.from(registry.values()).map((tool) => {
    const schema = z.toJSONSchema(tool.params, { target: 'draft-7' }) as Record<
      string,
      unknown
    >
    // OpenAI rejects unknown top-level keys on some providers; drop the
    // JSON-Schema dialect marker zod emits.
    delete schema.$schema
    const parameters = schema
    return {
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters,
      },
    }
  })
}
