"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { resolveAuthorizedScope } from "@/lib/auth/authorization"
import { buildAuthRedirectUrl, sendStaffOtpEmail } from "@/lib/auth/otp"
import { logAuditEvent } from "@/lib/auth/support-sessions"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Admin-triggered actions on a user account. All require platform_admin
 * scope, all write to public.audit_events with a `staff_user.*` event
 * type (see (dashboard)/settings/audit for the live feed).
 *
 * Naming follows the user-facing dropdown labels in
 * components/users/user-actions-menu.tsx — sendSignInCode, not
 * "resendOtp"; revokeAllSessions, not "forceSignOut".
 */

export interface AdminUserActionResult {
  success?: boolean
  error?: string
}

const GRACE_PERIOD_DAYS = 30

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

/** Send a magic-link OTP to a target user, just as a self-initiated sign-in would. */
export async function sendSignInCode(targetProfileId: string): Promise<AdminUserActionResult> {
  try {
    const scope = await requirePlatformAdmin()
    if (!scope.actor) return { error: "Not authorised" }

    const db = createAdminClient()
    const { data: target, error: lookupError } = await db
      .from("profiles")
      .select("id, email")
      .eq("id", targetProfileId)
      .single()
    if (lookupError || !target) return { error: lookupError?.message ?? "User not found" }

    await logAuditEvent({
      actorProfileId: scope.actor.id,
      eventType: "staff_user.otp_resent",
      targetTable: "profiles",
      targetId: target.id,
      metadata: { email: target.email },
    })

    const headerStore = await headers()
    const redirectUrl = buildAuthRedirectUrl({
      origin: buildRequestUrlFromHeaders(headerStore),
      redirectPath: "/auth/callback",
      publicAppUrl: process.env.PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
      adminAppUrl: process.env.ADMIN_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
      fallbackUrl: "http://localhost:3002",
    })
    await sendStaffOtpEmail({ email: target.email, redirectUrl })

    revalidatePath(`/users/${targetProfileId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Revoke all refresh tokens for a target user. Their current access
 * tokens stay valid until TTL (~1hr) but they can't get new ones.
 */
export async function revokeAllSessions(targetProfileId: string): Promise<AdminUserActionResult> {
  try {
    const scope = await requirePlatformAdmin()
    if (!scope.actor) return { error: "Not authorised" }

    const db = createAdminClient()
    const { data: target, error: lookupError } = await db
      .from("profiles")
      .select("id, email")
      .eq("id", targetProfileId)
      .single()
    if (lookupError || !target) return { error: lookupError?.message ?? "User not found" }

    const { error: signOutError } = await db.auth.admin.signOut(target.id, "global")
    if (signOutError) return { error: `signOut failed: ${signOutError.message}` }

    // Audit only after successful revocation (Codex P1 #142).
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
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Schedule a target user's account for deletion in 30 days. Uses the
 * same Stage A / Stage B flow as user-initiated deletion (see
 * src/app/actions/account-deletion.ts and the nightly cron).
 */
export async function scheduleUserDeletion(targetProfileId: string): Promise<AdminUserActionResult> {
  try {
    const scope = await requirePlatformAdmin()
    if (!scope.actor) return { error: "Not authorised" }

    const db = createAdminClient()
    const now = new Date()
    const scheduledFor = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)

    const { data: target, error: updateError } = await db
      .from("profiles")
      .update({
        deletion_requested_at: now.toISOString(),
        scheduled_deletion_at: scheduledFor.toISOString(),
      })
      .eq("id", targetProfileId)
      .select("email, scheduled_deletion_at")
      .single()
    if (updateError || !target) return { error: updateError?.message ?? "Failed to schedule" }

    await logAuditEvent({
      actorProfileId: scope.actor.id,
      eventType: "staff_user.deletion_scheduled",
      targetTable: "profiles",
      targetId: targetProfileId,
      metadata: { scheduled_for: target.scheduled_deletion_at, email: target.email, by: "admin" },
    })

    revalidatePath(`/users/${targetProfileId}`)
    revalidatePath("/users")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

/** Undo a pending deletion (admin-initiated cancel). */
export async function cancelUserDeletion(targetProfileId: string): Promise<AdminUserActionResult> {
  try {
    const scope = await requirePlatformAdmin()
    if (!scope.actor) return { error: "Not authorised" }

    const db = createAdminClient()
    const { data: target, error: updateError } = await db
      .from("profiles")
      .update({ deletion_requested_at: null, scheduled_deletion_at: null })
      .eq("id", targetProfileId)
      .select("email")
      .single()
    if (updateError || !target) return { error: updateError?.message ?? "Failed to cancel" }

    await logAuditEvent({
      actorProfileId: scope.actor.id,
      eventType: "staff_user.deletion_cancelled",
      targetTable: "profiles",
      targetId: targetProfileId,
      metadata: { email: target.email, by: "admin" },
    })

    revalidatePath(`/users/${targetProfileId}`)
    revalidatePath("/users")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
