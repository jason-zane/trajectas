import { Resend } from 'resend'

let resendClient: Resend | null = null

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

export interface SendHtmlEmailAttachment {
  filename: string
  /** Base64-encoded file content. */
  content: string
  contentType?: string
}

export interface SendHtmlEmailOptions {
  /** Set only by the staff OTP template path, never by client form data. */
  purpose?: 'staff_auth'
  to: string | string[]
  subject: string
  html: string
  text: string
  from?: string
  replyTo?: string
  attachments?: SendHtmlEmailAttachment[]
}

export async function sendHtmlEmail(options: SendHtmlEmailOptions) {
  const staffOnlyPreview = process.env.VERCEL_ENV === 'preview' && (
    process.env.TRAJECTAS_PERSONALITY_PREVIEW_TARGET === 'bgrvqvtlhmfmvcytncgw' ||
    process.env.VERCEL_GIT_COMMIT_REF === 'codex/personality-preview-ready-20261030'
  )
  if (staffOnlyPreview && (
    options.purpose !== 'staff_auth' || typeof options.to !== 'string' || options.attachments?.length
  )) {
    throw new Error('This synthetic Preview only sends staff sign-in codes; other outbound email is disabled.')
  }
  const client = getResendClient()
  const from =
    options.from ?? process.env.EMAIL_FROM ?? 'Trajectas <noreply@mail.trajectas.com>'
  const { data, error } = await client.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo,
    attachments: options.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  })

  // The Resend SDK resolves with { data, error } and does NOT reject on
  // API-level failures (unverified domain, suppressed recipient, rate limit,
  // etc.). Left unchecked, those rejections are silently swallowed: the caller
  // believes the email was sent. Surface them as thrown errors so they reach
  // logs/observability and any caller's own error handling.
  if (error) {
    const recipientCount = Array.isArray(options.to) ? options.to.length : 1
    const message = `Resend rejected email to ${recipientCount} recipient(s): ${error.name ?? 'error'} — ${error.message ?? 'unknown error'}`
    console.error(`[email] ${message}`)
    throw new Error(message)
  }

  if (staffOnlyPreview && data?.id) {
    // Positive delivery evidence without recipients, OTPs or bearer links.
    console.info('[email] Preview staff sign-in email accepted', { providerMessageId: data.id })
  }
  return data
}
