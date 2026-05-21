"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { resolveAuthorizedScope } from "@/lib/auth/authorization"
import { buildAuthRedirectUrl, sendStaffOtpEmail } from "@/lib/auth/otp"
import { logAuditEvent } from "@/lib/auth/support-sessions"
import { createAdminClient } from "@/lib/supabase/admin"

export interface AdminActionResult {
  success?: boolean
  error?: string
}

function buildRequestUrlFromHeaders(headerStore: Awaited<ReturnType<typeof headers>>) {
  const origin = headerStore.get("origin")
  if (origin) return origin
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host")
  const protocol =
    headerStore.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http")
  if (host) return `${protocol}://${host}`
  return process.env.PUBLIC_APP_URL ?? process.env.ADMIN_APP_URL ?? "http://localhost:3002"
}

async function requirePlatformAdmin() {
  const scope = await resolveAuthorizedScope()
  if (!scope.actor || !scope.isPlatformAdmin) {
    throw new Error("Not authorised")
  }
  return scope
}

/**
 * Send (or re-send) a sign-in OTP to a target user's email. Uses the
 * same email flow as a user-initiated sign-in — the target receives a
 * code they can enter at /login as if they had requested it themselves.
 *
 * Logged as `staff_user.otp_resent` in audit_events.
 */
export async function adminResendOtp(targetProfileId: string): Promise<AdminActionResult> {
  try {
    const scope = await requirePlatformAdmin()
    if (!scope.actor) return { error: "Not authorised" }

    const db = createAdminClient()
    const { data: target, error: lookupError } = await db
      .from("profiles")
      .select("id, email")
      .eq("id", targetProfileId)
      .single()

    if (lookupError || !target) {
      return { error: lookupError?.message ?? "User not found" }
    }

    await logAuditEvent({
      actorProfileId: scope.actor.id,
      eventType: "staff_user.otp_resent",
      targetTable: "profiles",
      targetId: target.id,
      metadata: { email: target.email },
    })

    const headerStore = await headers()
    const requestOrigin = buildRequestUrlFromHeaders(headerStore)
    const redirectUrl = buildAuthRedirectUrl({
      origin: requestOrigin,
      redirectPath: "/auth/callback",
      publicAppUrl: process.env.PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
      adminAppUrl: process.env.ADMIN_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
      fallbackUrl: "http://localhost:3002",
    })

    await sendStaffOtpEmail({ email: target.email, redirectUrl })

    revalidatePath(`/users/${targetProfileId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}

/**
 * Force a target user to sign out everywhere by revoking all of their
 * refresh tokens. Their current sessions remain valid until the access
 * token TTL expires (Supabase default ~1 hour), then they're forced
 * to re-authenticate via OTP. Use when you suspect a session has been
 * compromised or when revoking access immediately is needed.
 *
 * Logged as `staff_user.force_signed_out` in audit_events.
 */
export async function adminForceSignOut(
  targetProfileId: string,
): Promise<AdminActionResult> {
  try {
    const scope = await requirePlatformAdmin()
    if (!scope.actor) return { error: "Not authorised" }

    const db = createAdminClient()
    const { data: target, error: lookupError } = await db
      .from("profiles")
      .select("id, email")
      .eq("id", targetProfileId)
      .single()

    if (lookupError || !target) {
      return { error: lookupError?.message ?? "User not found" }
    }

    const { error: signOutError } = await db.auth.admin.signOut(target.id, "global")
    if (signOutError) {
      return { error: `signOut failed: ${signOutError.message}` }
    }

    // Audit only after the revocation actually succeeds, so the audit
    // trail never claims a force-sign-out that didn't happen.
    await logAuditEvent({
      actorProfileId: scope.actor.id,
      eventType: "staff_user.force_signed_out",
      targetTable: "profiles",
      targetId: target.id,
      metadata: { email: target.email },
    })

    revalidatePath(`/users/${targetProfileId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}

/**
 * Clear the processing state on a participant_sessions row so a stuck
 * scoring/processing run can be retried. Targets the common "completed
 * but processing_status=failed" stuck state (6 sessions currently in
 * that bucket on prod).
 *
 * Does NOT clear responses, position, or status — that would be a
 * destructive "hard reset" which we deliberately don't ship as an
 * admin action without a separate UX flow.
 *
 * Logged as `participant_session.reset_by_admin`.
 */
export async function adminResetParticipantSession(
  sessionId: string,
): Promise<AdminActionResult> {
  try {
    const scope = await requirePlatformAdmin()
    if (!scope.actor) return { error: "Not authorised" }

    const db = createAdminClient()
    const { data: session, error: lookupError } = await db
      .from("participant_sessions")
      .select("id, processing_status, processing_error, participant_profile_id")
      .eq("id", sessionId)
      .single()

    if (lookupError || !session) {
      return { error: lookupError?.message ?? "Session not found" }
    }

    const previousState = {
      processing_status: session.processing_status,
      processing_error: session.processing_error,
    }

    const { error: updateError } = await db
      .from("participant_sessions")
      .update({
        processing_status: "idle",
        processing_error: null,
        processed_at: null,
      })
      .eq("id", sessionId)

    if (updateError) {
      return { error: updateError.message }
    }

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
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}
