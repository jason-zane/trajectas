// =============================================================================
// src/lib/chat/registry.ts
//
// The tool registry. A chat tool is a named, zod-validated function over the
// REQUESTING USER'S Supabase client — never the admin client. Membership-level
// tenancy comes from the RLS policies attached to that connection, so the same
// tool body answers broadly for a platform admin and narrowly for a client
// member.
//
// RLS is not the whole boundary, though. It scopes by MEMBERSHIP: policies call
// auth_user_client_ids(), and is_platform_admin() is role-only, so neither
// knows which workspace the caller is standing in — the active context and any
// support session live in a signed cookie that never reaches Postgres. A tool
// that reads tenant-scoped rows must therefore also apply ctx.scope.
//
// tests/architecture/chat-rls-client.test.ts fails CI if anything under
// src/lib/chat/ imports the admin client (src/lib/chat/audit.ts is the single
// allow-listed exception, and it only writes).
// =============================================================================

import 'server-only'

import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type OpenAI from 'openai'
import type { ChatSearchScope } from '@/lib/dal/chat-search'
import type { ChatBlock, ToolEnvelope } from './envelope'

/** What a tool may do with the request beyond querying. */
export interface ChatToolContext {
  /** The requester's RLS-scoped client. Tenancy comes from its JWT. */
  db: SupabaseClient
  /** True only for platform admins — used for data-source policy, not access. */
  isPlatformAdmin: boolean
  /**
   * The caller's active workspace boundary, resolved once per request. `null`
   * on a field means unrestricted; an EMPTY ARRAY means restricted to nothing
   * and must yield no rows — see resolveTenantClientFilter.
   */
  scope: ChatSearchScope
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
  /**
   * Structured payloads for the browser to render. Declared per tool rather
   * than inferred from result keys, so adding a tool cannot silently produce
   * the wrong card.
   */
  toBlocks?: (data: TData) => ChatBlock[]
  /**
   * What the MODEL is allowed to see of this result. Tools returning
   * measurements implement this to strip every numeric value, leaving
   * identity and code-computed ordinal facts. The full data still reaches the
   * browser via toBlocks — so the numbers on screen never passed through the
   * token stream, and restating one wrongly is impossible rather than merely
   * discouraged. Omit for tools whose results carry no measurements.
   */
  redactForModel?: (data: TData) => unknown
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
