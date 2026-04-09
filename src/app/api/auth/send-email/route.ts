/**
 * Supabase Auth send_email hook handler.
 *
 * Supabase calls this webhook instead of its built-in email delivery whenever
 * a magic link, signup, invite, recovery, etc. email is triggered.
 *
 * Flow:
 * 1. Verify signature via Standard Webhooks (v1,whsec_ secret format)
 * 2. Map Supabase email_action_type → our EmailType
 * 3. Construct sign-in / action URL from token_hash + redirect_to
 * 4. Send via our unified sendEmail pipeline
 * 5. Return 200 (empty body = success for the hook contract)
 */

import { NextResponse } from 'next/server'
import { Webhook } from 'standardwebhooks'
import { sendEmail } from '@/lib/email/send'
import type { EmailType } from '@/lib/email/types'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Supabase email_action_type → our EmailType mapping
// ---------------------------------------------------------------------------

const TYPE_MAP: Record<string, EmailType> = {
  magiclink: 'magic_link',
  signup: 'welcome',
  invite: 'staff_invite',
}

// Types we don't handle yet — we log and let Supabase fall back
const UNSUPPORTED_TYPES = new Set(['recovery', 'email_change', 'reauthentication'])

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET
  if (!hookSecret) {
    console.error('[send-email hook] SUPABASE_AUTH_HOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Server misconfiguration' },
      { status: 500 },
    )
  }

  // 1. Read body + verify via Standard Webhooks
  const rawBody = await request.text()
  const headers = Object.fromEntries(request.headers)

  // Extract the base64 secret (strip "v1,whsec_" prefix)
  const base64Secret = hookSecret.replace('v1,whsec_', '')

  let payload: {
    user: { id: string; email: string; user_metadata?: Record<string, unknown> }
    email_data: {
      email_action_type: string
      token_hash: string
      redirect_to: string
      token?: string
      hashed_token?: string
    }
  }

  try {
    const wh = new Webhook(base64Secret)
    payload = wh.verify(rawBody, headers) as typeof payload
  } catch (err) {
    console.error('[send-email hook] Signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 },
    )
  }

  const { user, email_data } = payload
  const actionType = email_data.email_action_type

  // 3. Check for unsupported types
  if (UNSUPPORTED_TYPES.has(actionType)) {
    console.warn(
      `[send-email hook] Unsupported email_action_type: ${actionType} for user ${user.id}`,
    )
    // Return success so Supabase doesn't retry — these types fall back to
    // Supabase's built-in emails until we add templates for them.
    return NextResponse.json({})
  }

  const emailType = TYPE_MAP[actionType]
  if (!emailType) {
    console.warn(
      `[send-email hook] Unknown email_action_type: ${actionType} for user ${user.id}`,
    )
    return NextResponse.json({})
  }

  // 4. Construct action URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const confirmUrl = new URL('/auth/v1/verify', supabaseUrl)
  confirmUrl.searchParams.set('type', actionType)
  confirmUrl.searchParams.set('token_hash', email_data.token_hash)
  if (email_data.redirect_to) {
    confirmUrl.searchParams.set('redirect_to', email_data.redirect_to)
  }

  // 5. Build variables per email type
  const firstName =
    (user.user_metadata?.first_name as string) ??
    (user.user_metadata?.name as string) ??
    ''

  const variables: Record<string, string> = {
    brandName: 'Trajectas',
  }

  switch (emailType) {
    case 'magic_link':
      variables.otpCode = email_data.token ?? confirmUrl.toString()
      break
    case 'welcome':
      variables.userName = firstName || user.email
      variables.loginUrl = process.env.NEXT_PUBLIC_APP_URL ?? supabaseUrl
      break
    case 'staff_invite':
      variables.inviteeName = firstName || user.email
      variables.acceptUrl = confirmUrl.toString()
      break
  }

  // 6. Send
  try {
    await sendEmail({
      type: emailType,
      to: user.email,
      variables,
    })
  } catch (err) {
    console.error('[send-email hook] Failed to send email:', err)
    return NextResponse.json(
      { error: 'Email delivery failed' },
      { status: 500 },
    )
  }

  return NextResponse.json({})
}
