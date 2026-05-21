import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

export interface AdminActionLogInput {
  actorProfileId: string
  action: string
  targetProfileId?: string | null
  targetKind?: string
  targetId?: string | null
  payload?: Record<string, unknown> | null
}

/**
 * Record one row in admin_action_audit for an action performed via the
 * /admin surface. Every mutating server action under src/app/(dashboard)/admin/
 * must call this BEFORE (or atomically with) the actual mutation, so we
 * keep an evidence trail even if the mutation succeeds partially or
 * gets rolled back.
 *
 * Failures here are intentionally NOT caught — if we can't audit, we
 * don't act. Callers must propagate the error and abort the action.
 *
 * See docs/superpowers/plans/2026-05-21-admin-dashboard.md for the
 * action taxonomy.
 */
export async function logAdminAction(input: AdminActionLogInput): Promise<void> {
  const db = createAdminClient()
  const { error } = await db.from("admin_action_audit").insert({
    actor_profile_id: input.actorProfileId,
    action: input.action,
    target_profile_id: input.targetProfileId ?? null,
    target_kind: input.targetKind ?? "profile",
    target_id: input.targetId ?? null,
    payload: input.payload ?? null,
  })
  if (error) {
    throw new Error(`admin_action_audit insert failed: ${error.message}`)
  }
}
