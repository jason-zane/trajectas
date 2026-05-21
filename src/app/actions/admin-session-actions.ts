"use server"

import { revalidatePath } from "next/cache"
import { resolveAuthorizedScope } from "@/lib/auth/authorization"
import { logAuditEvent } from "@/lib/auth/support-sessions"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Admin-triggered actions on participant_sessions. Platform-admin-only,
 * logged to audit_events under `participant_session.*` event types.
 */

export interface AdminSessionActionResult {
  success?: boolean
  error?: string
}

async function requirePlatformAdmin() {
  const scope = await resolveAuthorizedScope()
  if (!scope.actor || !scope.isPlatformAdmin) {
    throw new Error("Not authorised")
  }
  return scope
}

/**
 * Clear the processing state on a participant_sessions row so a stuck
 * scoring/processing run can be retried. Does NOT clear responses,
 * position, or status — that would be a destructive "hard reset" which
 * lives outside the dropdown.
 */
export async function resetSessionProcessing(sessionId: string): Promise<AdminSessionActionResult> {
  try {
    const scope = await requirePlatformAdmin()
    if (!scope.actor) return { error: "Not authorised" }

    const db = createAdminClient()
    const { data: session, error: lookupError } = await db
      .from("participant_sessions")
      .select("id, processing_status, processing_error, participant_profile_id")
      .eq("id", sessionId)
      .single()
    if (lookupError || !session) return { error: lookupError?.message ?? "Session not found" }

    const previousState = {
      processing_status: session.processing_status,
      processing_error: session.processing_error,
    }

    const { error: updateError } = await db
      .from("participant_sessions")
      .update({ processing_status: "idle", processing_error: null, processed_at: null })
      .eq("id", sessionId)
    if (updateError) return { error: updateError.message }

    await logAuditEvent({
      actorProfileId: scope.actor.id,
      eventType: "participant_session.reset_by_admin",
      targetTable: "participant_sessions",
      targetId: sessionId,
      metadata: { previous: previousState },
    })

    revalidatePath(`/participants/${session.participant_profile_id}`)
    revalidatePath(`/participants/${session.participant_profile_id}/sessions/${sessionId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
