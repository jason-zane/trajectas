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

export interface SendHtmlEmailOptions {
  to: string
  subject: string
  html: string
  text: string
  from?: string
  replyTo?: string
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
  })
}
