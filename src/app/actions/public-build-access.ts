'use server'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { checkBotId } from 'botid/server'
import { z } from 'zod'
import { escapeHtml } from '@/lib/security/escape-html'
import { sendHtmlEmail } from '@/lib/email/provider'
import { checkKeyedRateLimit } from '@/lib/security/rate-limit'
import { logActionError } from '@/lib/security/action-errors'
import { getPublicBuildsMode } from '@/lib/public-builds/constants'

const emailSchema = z.string().trim().toLowerCase().email().max(254)
const inbox = 'hello@trajectas.com'

export async function requestBuildAccess(input: { email: string }): Promise<
  { success: true; confirmationSent: boolean } | { error: string }
> {
  const parsed = emailSchema.safeParse(input?.email)
  if (!parsed.success) return { error: 'Enter a valid email address.' }
  if (getPublicBuildsMode() === 'off') return { error: 'The Role Builder is unavailable right now. Please use our contact page.' }
  const email = parsed.data

  try {
    const verification = await checkBotId()
    if (verification.isBot) return { error: 'We couldn’t verify this request. Please try again.' }
    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
    const hash = (value: string) => createHash('sha256').update(value).digest('hex')
    // Bound both recipient mail and the shared inbox, including distributed abuse.
    for (const [key, limit, window] of [
      [`public-build-access-ip:${hash(ip)}`, 5, 3_600_000],
      [`public-build-access-email:${hash(email)}`, 2, 86_400_000],
      ['public-build-access-total', 50, 3_600_000],
    ] as const) {
      const result = await checkKeyedRateLimit(key, limit, window, true)
      if (!result || !result.allowed) return { error: 'Too many requests. Please try again later.' }
    }
    // Notify the team first: never confirm receipt if this delivery was rejected.
    await sendHtmlEmail({
      to: inbox,
      replyTo: email,
      subject: 'Role Builder — invitation requested',
      html: `<p>Role Builder invitation requested by <strong>${escapeHtml(email)}</strong>.</p><p>Reply to this email to send them the preview invitation code. Access has not been granted automatically.</p>`,
      text: `Role Builder invitation requested by ${email}.\n\nReply to this email to send them the preview invitation code. Access has not been granted automatically.`,
    })
  } catch (error) {
    logActionError('publicBuilds.requestAccess', error)
    return { error: 'We couldn’t send your request. Please try again, or use our contact page.' }
  }

  try {
    await sendHtmlEmail({
      to: email,
      replyTo: inbox,
      subject: 'We’ve received your Role Builder access request',
      html: '<h1>Your request is with Trajectas.</h1><p>Thank you for your interest in the Role Builder preview. We’ll review your request and email you an invitation code if access is available.</p><p>You don’t need to do anything else yet. This email confirms your request; it does not grant access.</p><p>Questions? Reply to this email.</p>',
      text: 'Your request is with Trajectas.\n\nThank you for your interest in the Role Builder preview. We’ll review your request and email you an invitation code if access is available.\n\nYou don’t need to do anything else yet. This email confirms your request; it does not grant access.\n\nQuestions? Reply to this email.',
    })
    return { success: true, confirmationSent: true }
  } catch (error) {
    logActionError('publicBuilds.requestAccess.confirmation', error)
    // The team already has the request. Do not encourage duplicate submissions.
    return { success: true, confirmationSent: false }
  }
}
