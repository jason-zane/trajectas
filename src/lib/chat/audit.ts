// =============================================================================
// src/lib/chat/audit.ts
//
// Tool-call audit. This is the ONE module under src/lib/chat permitted to open
// the admin client, and it only ever INSERTs — audit_events is append-only
// (20260611180315_append_only_audit_tables.sql revokes UPDATE/DELETE and a
// trigger blocks mutation even for service_role).
//
// client_id is deliberately left NULL. audit_events has a tenant-scoped SELECT
// policy, so stamping a client_id here would make chat operational metadata
// (tool names, row counts, timings) readable by that client's own members.
// These rows are for platform forensics, not customer-visible activity.
// =============================================================================

import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { logActionError } from '@/lib/security/action-errors'

export interface ChatToolCallAudit {
  actorProfileId: string | null
  tool: string
  mode: string
  outcome: 'ok' | 'failed'
  reason?: string
  rowCount: number | null
  durationMs: number
}

/**
 * Record one tool invocation. Never throws: an audit failure must not take the
 * user's answer down with it, but it is reported so the gap is visible.
 */
export async function recordChatToolCall(entry: ChatToolCallAudit): Promise<void> {
  try {
    const db = createAdminClient()
    await db.from('audit_events').insert({
      event_type: 'chat_tool_call',
      actor_profile_id: entry.actorProfileId,
      target_table: 'chat',
      target_id: null,
      client_id: null,
      metadata: {
        tool: entry.tool,
        mode: entry.mode,
        outcome: entry.outcome,
        ...(entry.reason ? { reason: entry.reason } : {}),
        rowCount: entry.rowCount,
        durationMs: entry.durationMs,
      },
    })
  } catch (error) {
    logActionError('chat.audit.tool_call', error)
  }
}
