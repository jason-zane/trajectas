"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { logAdminAction } from "@/lib/admin/log-action"
import { resolveAuthorizedScope } from "@/lib/auth/authorization"
import { buildAuthRedirectUrl, sendStaffOtpEmail } from "@/lib/auth/otp"
import { createAdminClient } from "@/lib/supabase/admin"

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

export interface AdminActionResult {
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
 * Send (or re-send) a sign-in OTP to a target user's email. Uses the
 * same email flow as a user-initiated sign-in — the target receives a
 * code they can enter at /login as if they had requested it themselves.
 *
 * Logged to admin_action_audit before the email is sent so we have
 * evidence even if email delivery fails downstream.
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

    await logAdminAction({
      actorProfileId: scope.actor.id,
      action: "resend_otp",
      targetProfileId: target.id,
      payload: { email: target.email },
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

    revalidatePath(`/admin/users/${targetProfileId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}
