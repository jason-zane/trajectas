'use server'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildAuthRedirectUrl,
  sendInviteOtpEmail,
  sendStaffOtpEmail,
} from '@/lib/auth/otp'
import { logActionError } from '@/lib/security/action-errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getInviteByToken } from '@/lib/auth/staff-auth'

export type AuthFormState =
  | {
      success?: string
      error?: string
      fields?: Record<string, string[]>
      step?: 'email' | 'code'
      email?: string
      invite?: string
      next?: string
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

async function sendOtp(input: {
  email: string
  redirectPath: string
  template: 'magic_link' | 'staff_invite'
  inviteeName?: string | null
}) {
  const redirectUrl = buildAuthRedirectUrl({
    redirectPath: input.redirectPath,
    publicAppUrl: process.env.PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    adminAppUrl: process.env.ADMIN_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    fallbackUrl: 'http://localhost:3002',
  })

  if (input.template === 'staff_invite') {
    await sendInviteOtpEmail({
      email: input.email,
      redirectUrl,
      inviteeName: input.inviteeName,
    })
    return
  }

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

  const db = createAdminClient()
  const { data: profile } = await db
    .from('profiles')
    .select('id')
    .eq('email', parsed.data.email)
    .eq('is_active', true)
    .maybeSingle()

  if (profile) {
    try {
      await sendOtp(
        {
          email: parsed.data.email,
          redirectPath: buildCallbackPath(parsed.data.next ?? null, null),
          template: 'magic_link',
        }
      )
    } catch (error) {
      // Keep the response generic so login does not reveal account state.
      logActionError('requestStaffOtp.sendOtp', error)
    }
  }

  return {
    step: 'code',
    email: parsed.data.email,
    next: parsed.data.next,
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
      template: 'staff_invite',
      inviteeName: invite.email,
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

  return {
    step: 'code',
    email: invite.email,
    invite: token,
    next,
    success: `We've sent a sign-in code to ${invite.email}. Enter the code to accept the invite.`,
  }
}

export async function signOutStaff() {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }
}
