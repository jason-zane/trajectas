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
  to: string | string[]
  subject: string
  html: string
  text: string
  from?: string
  replyTo?: string
  attachments?: SendHtmlEmailAttachment[]
}

export async function sendHtmlEmail(options: SendHtmlEmailOptions) {
  const client = getResendClient()
  const from =
    options.from ?? process.env.EMAIL_FROM ?? 'Trajectas <noreply@mail.trajectas.com>'
  return client.emails.send({
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
}
