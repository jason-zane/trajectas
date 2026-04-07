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

export interface SendEmailOptions {
  to: string
  subject: string
  react: React.ReactElement
  from?: string
  replyTo?: string
}

export async function sendEmail(options: SendEmailOptions) {
  const client = getResendClient()
  const from =
    options.from ?? process.env.EMAIL_FROM ?? 'Trajectas <noreply@trajectas.com>'

  return client.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    react: options.react,
    replyTo: options.replyTo,
  })
}
