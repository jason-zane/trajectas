'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  buildAuthRedirectUrl,
  sendStaffOtpEmail,
} from '@/lib/auth/otp'
import { logActionError } from '@/lib/security/action-errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  buildSurfaceAuthUrl,
  getInviteByToken,
  resolveDefaultWorkspaceContextForEmail,
} from '@/lib/auth/staff-auth'
import { inferSurfaceFromRequest, requireAppUrl } from '@/lib/hosts'
import type { WorkspaceSurface } from '@/lib/surfaces'

export type AuthFormState =
  | {
      success?: string
      error?: string
      fields?: Record<string, string[]>
      step?: 'email' | 'code'
      email?: string
      invite?: string
      next?: string
      redirectTo?: string
    }
  | undefined

const emailSchema = z.object({
  email: z.email('Enter a valid email address.').trim().toLowerCase(),
  next: z.string().optional(),
})

function buildCallbackPath(next?: string | null, invite?: string | null) {
  const params = new URLSearchParams()
  if (invite) {
    params.set('invite', invite)
  }
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    params.set('next', next)
  }

  const query = params.toString()
  return query ? `/auth/callback?${query}` : '/auth/callback'
}

function buildRequestUrlFromHeaders(headerStore: Awaited<ReturnType<typeof headers>>) {
  const origin = headerStore.get('origin')
  if (origin) {
    return origin
  }

  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
  const protocol =
    headerStore.get('x-forwarded-proto') ??
    (process.env.NODE_ENV === 'production' ? 'https' : 'http')

  if (host) {
    return `${protocol}://${host}`
  }

  return requireAppUrl('public')
}

async function buildCodeEntryRedirect(input: {
  surface: WorkspaceSurface
  authPath: '/login' | '/auth/accept'
  email: string
  next?: string | null
  invite?: string | null
}) {
  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
  const currentSurface = inferSurfaceFromRequest({
    host,
    pathname: input.authPath,
  })

  if (currentSurface === input.surface) {
    return null
  }

  const params = new URLSearchParams()
  params.set('email', input.email)
  params.set('step', 'code')

  if (input.invite) {
    params.set('invite', input.invite)
  }

  if (input.next && input.next.startsWith('/') && !input.next.startsWith('//')) {
    params.set('next', input.next)
  }

  return buildSurfaceAuthUrl({
    surface: input.surface,
    authPath: input.authPath,
    requestUrl: buildRequestUrlFromHeaders(headerStore),
    host,
    params,
  }).toString()
}

async function sendOtp(input: {
  email: string
  redirectPath: string
}) {
  const headerStore = await headers()
  const requestOrigin = buildRequestUrlFromHeaders(headerStore)

  const redirectUrl = buildAuthRedirectUrl({
    origin: requestOrigin,
    redirectPath: input.redirectPath,
    publicAppUrl: requireAppUrl('public'),
    adminAppUrl: requireAppUrl('admin'),
  })

  await sendStaffOtpEmail({
    email: input.email,
    redirectUrl,
  })
}

export async function requestStaffOtp(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse({
    email: formData.get('email'),
    next: formData.get('next'),
  })

  if (!parsed.success) {
    return { fields: parsed.error.flatten().fieldErrors }
  }

  const context = await resolveDefaultWorkspaceContextForEmail(parsed.data.email)

  if (context) {
    try {
      await sendOtp(
        {
          email: parsed.data.email,
          redirectPath: buildCallbackPath(parsed.data.next ?? null, null),
        }
      )
    } catch (error) {
      // Keep the response generic so login does not reveal account state.
      logActionError('requestStaffOtp.sendOtp', error)
    }
  }

  const redirectTo = context
    ? await buildCodeEntryRedirect({
        surface: context.surface,
        authPath: '/login',
        email: parsed.data.email,
        next: parsed.data.next ?? null,
      })
    : null

  return {
    step: 'code',
    email: parsed.data.email,
    next: parsed.data.next,
    redirectTo: redirectTo ?? undefined,
    success:
      "If that email has staff access, we've sent a sign-in code. Check your inbox.",
  }
}

export async function requestInviteOtp(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const token = String(formData.get('invite') ?? '')
  const next = String(formData.get('next') ?? '')
  const invite = token ? await getInviteByToken(token) : null

  if (!invite) {
    return { error: 'This invite is invalid or expired.' }
  }

  if (invite.revokedAt || invite.acceptedAt || new Date(invite.expiresAt).getTime() <= Date.now()) {
    return { error: 'This invite is invalid or expired.' }
  }

  try {
    await sendOtp({
      email: invite.email,
      redirectPath: buildCallbackPath(next, token),
    })
  } catch (error) {
    logActionError('requestInviteOtp.sendOtp', error)
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to send the sign-in code right now.',
    }
  }

  const surface: WorkspaceSurface =
    invite.tenantType === 'partner'
      ? 'partner'
      : invite.tenantType === 'client'
        ? 'client'
        : 'admin'

  const redirectTo = await buildCodeEntryRedirect({
    surface,
    authPath: '/auth/accept',
    email: invite.email,
    next,
    invite: token,
  })

  return {
    step: 'code',
    email: invite.email,
    invite: token,
    next,
    redirectTo: redirectTo ?? undefined,
    success: `We've sent a sign-in code to ${invite.email}. Enter the code to accept the invite.`,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// OTP verify actions
//
// These run server-side so the verify step works without depending on the
// browser reaching *.supabase.co directly (which some corporate firewalls
// block) and without depending on React's synthetic onChange firing on
// browser/password-manager autofill of the code input (a long-standing
// React/controlled-input gap — see facebook/react#2125).
//
// On success they call redirect() server-side, so the flow works without
// client-side JS. On failure they return an AuthFormState with an error.
// ────────────────────────────────────────────────────────────────────────────

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your email.'),
})

const GENERIC_VERIFY_ERROR =
  "That code didn't work. Request a new one and try again."

function sanitizeNextPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export async function verifyStaffOtp(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const emailRaw = formData.get('email')
  const codeRaw = formData.get('code')
  const next = sanitizeNextPath(formData.get('next'))

  const emailParsed = emailSchema.safeParse({ email: emailRaw, next: next ?? undefined })
  if (!emailParsed.success) {
    return { error: 'Request a fresh sign-in code to continue.', step: 'code' }
  }

  const codeParsed = codeSchema.safeParse({ code: codeRaw })
  if (!codeParsed.success) {
    return {
      error: codeParsed.error.flatten().fieldErrors.code?.[0] ?? GENERIC_VERIFY_ERROR,
      step: 'code',
      email: emailParsed.data.email,
      next: next ?? undefined,
    }
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.verifyOtp({
    email: emailParsed.data.email,
    token: codeParsed.data.code,
    type: 'email',
  })

  if (error) {
    logActionError('verifyStaffOtp.verifyOtp', error)
    return {
      error: GENERIC_VERIFY_ERROR,
      step: 'code',
      email: emailParsed.data.email,
      next: next ?? undefined,
    }
  }

  // redirect() throws a special error caught by Next.js — must not be
  // wrapped in try/catch that swallows it.
  redirect(buildCallbackPath(next, null))
}

export async function verifyInviteOtp(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const token = String(formData.get('invite') ?? '')
  const codeRaw = formData.get('code')
  const next = sanitizeNextPath(formData.get('next'))

  // Re-load the invite server-side. Do NOT trust a hidden email input —
  // the invite record is authoritative for which email we're verifying.
  const invite = token ? await getInviteByToken(token) : null
  if (!invite) {
    return { error: 'This invite is invalid or expired.', step: 'code' }
  }

  if (
    invite.revokedAt ||
    invite.acceptedAt ||
    new Date(invite.expiresAt).getTime() <= Date.now()
  ) {
    return { error: 'This invite is invalid or expired.', step: 'code' }
  }

  const codeParsed = codeSchema.safeParse({ code: codeRaw })
  if (!codeParsed.success) {
    return {
      error: codeParsed.error.flatten().fieldErrors.code?.[0] ?? GENERIC_VERIFY_ERROR,
      step: 'code',
      email: invite.email,
      invite: token,
      next: next ?? undefined,
    }
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.verifyOtp({
    email: invite.email,
    token: codeParsed.data.code,
    type: 'email',
  })

  if (error) {
    logActionError('verifyInviteOtp.verifyOtp', error)
    return {
      error: GENERIC_VERIFY_ERROR,
      step: 'code',
      email: invite.email,
      invite: token,
      next: next ?? undefined,
    }
  }

  redirect(buildCallbackPath(next, token))
}

export async function signOutStaff() {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }
}
