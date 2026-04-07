'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildMagicLinkRedirectUrl } from '@/lib/auth/magic-link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getInviteByToken } from '@/lib/auth/staff-auth'

type AuthFormState =
  | {
      success?: string
      error?: string
      fields?: Record<string, string[]>
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

async function sendMagicLink(email: string, redirectPath: string) {
  const supabase = await createServerSupabaseClient()
  const headerStore = await headers()
  const redirectUrl = buildMagicLinkRedirectUrl({
    origin: headerStore.get('origin'),
    referer: headerStore.get('referer'),
    redirectPath,
    publicAppUrl: process.env.PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    adminAppUrl: process.env.ADMIN_APP_URL,
    fallbackUrl: 'http://localhost:3002',
  })

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl,
    },
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function requestStaffMagicLink(
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
      await sendMagicLink(
        parsed.data.email,
        buildCallbackPath(parsed.data.next ?? null, null)
      )
    } catch {
      // Keep the response generic so login does not reveal account state.
    }
  }

  return {
    success:
      "If that email has staff access, we've sent a sign-in link. Check your inbox to continue.",
  }
}

export async function requestInviteMagicLink(
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
    await sendMagicLink(invite.email, buildCallbackPath(next, token))
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to send the invite sign-in link right now.',
    }
  }

  return {
    success: `We've sent a sign-in link to ${invite.email}. Use that email account to accept the invite.`,
  }
}

export async function signOutStaff() {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }
}
