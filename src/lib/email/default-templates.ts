/**
 * Rich Maily.to Tiptap JSON templates for each email type.
 *
 * These serve as the platform-default editor_json for seeded rows in
 * email_templates. They use Maily node types: paragraph, heading, button,
 * variable, spacer, horizontalRule, and text with marks.
 */

import type { EmailType } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function text(t: string) {
  return { type: 'text' as const, text: t }
}

function bold(t: string) {
  return { type: 'text' as const, text: t, marks: [{ type: 'bold' as const }] }
}

function variable(id: string, fallback = '') {
  return {
    type: 'variable' as const,
    attrs: { id, fallback, showIfKey: null },
  }
}

function paragraph(content: unknown[], textAlign = 'left') {
  return { type: 'paragraph' as const, attrs: { textAlign }, content }
}

function heading(level: number, content: unknown[]) {
  return { type: 'heading' as const, attrs: { level }, content }
}

function button(label: string, urlVariable: string, opts?: { color?: string }) {
  return {
    type: 'button' as const,
    attrs: {
      text: label,
      url: urlVariable,
      isUrlVariable: true,
      variant: 'filled',
      buttonColor: opts?.color ?? '#000000',
      textColor: '#ffffff',
      borderRadius: 'smooth',
      alignment: 'left',
    },
  }
}

function spacer(height = 16) {
  return { type: 'spacer' as const, attrs: { height } }
}

function hr() {
  return { type: 'horizontalRule' as const }
}

function doc(...content: unknown[]) {
  return { type: 'doc' as const, content }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const MAGIC_LINK = doc(
  heading(2, [text('Sign in to '), variable('brandName', 'Trajectas')]),
  paragraph([
    text('Enter this code to sign in. It expires in 10 minutes.'),
  ]),
  spacer(8),
  paragraph([variable('otpCode', '------')]),
  spacer(8),
  paragraph([
    text('If you did not request this email, you can safely ignore it.'),
  ]),
)

const STAFF_INVITE = doc(
  heading(2, [text("You're Invited")]),
  paragraph([
    text('Hi '),
    variable('inviteeName', 'there'),
    text(','),
  ]),
  paragraph([
    text('You have been invited to join '),
    bold('Trajectas'),
    text(' as a team member. Enter this code to accept your invitation and set up your account.'),
  ]),
  spacer(8),
  paragraph([variable('otpCode', '------')]),
  spacer(8),
  paragraph([
    text('This code will expire in 7 days.'),
  ]),
)

const ASSESSMENT_INVITE = doc(
  heading(2, [variable('campaignTitle', 'Assessment')]),
  paragraph([
    text('Hi '),
    variable('participantFirstName', 'there'),
    text(','),
  ]),
  paragraph([
    text('You have been invited to complete an assessment: '),
    bold('{{campaignTitle}}'),
    text('.'),
  ]),
  paragraph([variable('campaignDescription', '')]),
  spacer(8),
  button('Start Assessment', 'assessmentUrl'),
  spacer(8),
  paragraph([
    text('If you have any questions, reply to this email.'),
  ]),
)

const ASSESSMENT_REMINDER = doc(
  heading(2, [text('Reminder: '), variable('campaignTitle', 'Assessment')]),
  paragraph([
    text('Hi '),
    variable('participantFirstName', 'there'),
    text(','),
  ]),
  paragraph([
    text('This is a friendly reminder that your assessment '),
    bold('{{campaignTitle}}'),
    text(' is still awaiting completion. You have '),
    variable('daysRemaining', 'a few'),
    text(' days remaining.'),
  ]),
  spacer(8),
  button('Continue Assessment', 'assessmentUrl'),
)

const REPORT_READY = doc(
  heading(2, [text('Your Report is Ready')]),
  paragraph([
    text('Hi '),
    variable('recipientName', 'there'),
    text(','),
  ]),
  paragraph([
    text('The report for '),
    bold('{{campaignTitle}}'),
    text(' is now available for review.'),
  ]),
  spacer(8),
  button('View Report', 'reportUrl'),
)

const WELCOME = doc(
  heading(2, [text('Welcome to '), variable('brandName', 'Trajectas')]),
  paragraph([
    text('Hi '),
    variable('userName', 'there'),
    text(','),
  ]),
  paragraph([
    text('Your account has been created. You can sign in anytime to get started.'),
  ]),
  spacer(8),
  button('Get Started', 'loginUrl'),
)

const ADMIN_NOTIFICATION = doc(
  heading(2, [variable('subject', 'Notification')]),
  paragraph([variable('message', '')]),
  spacer(8),
  button('{{actionLabel}}', 'actionUrl'),
)

// ---------------------------------------------------------------------------
// Export map
// ---------------------------------------------------------------------------

export const DEFAULT_TEMPLATES: Record<EmailType, Record<string, unknown>> = {
  magic_link: MAGIC_LINK,
  staff_invite: STAFF_INVITE,
  assessment_invite: ASSESSMENT_INVITE,
  assessment_reminder: ASSESSMENT_REMINDER,
  report_ready: REPORT_READY,
  welcome: WELCOME,
  admin_notification: ADMIN_NOTIFICATION,
}
