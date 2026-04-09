/**
 * Email type definitions and merge variable registry.
 *
 * This module is the single source of truth for:
 * - Which email types exist in the platform
 * - What merge variables each type accepts
 * - Realistic sample data for previews and test sends
 */

// ---------------------------------------------------------------------------
// Email types
// ---------------------------------------------------------------------------

export const EMAIL_TYPES = [
  'magic_link',
  'staff_invite',
  'assessment_invite',
  'assessment_reminder',
  'report_ready',
  'welcome',
  'admin_notification',
] as const

export type EmailType = (typeof EMAIL_TYPES)[number]

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

export type EmailTemplateScope = 'platform' | 'partner' | 'client'

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const EMAIL_TYPE_LABELS: Record<EmailType, string> = {
  magic_link: 'Sign-In Code',
  staff_invite: 'Staff Invitation',
  assessment_invite: 'Assessment Invitation',
  assessment_reminder: 'Assessment Reminder',
  report_ready: 'Report Ready',
  welcome: 'Welcome',
  admin_notification: 'Admin Notification',
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const EMAIL_TYPE_CATEGORIES: Record<string, EmailType[]> = {
  Authentication: ['magic_link', 'welcome'],
  Campaigns: ['assessment_invite', 'assessment_reminder', 'report_ready'],
  Platform: ['staff_invite', 'admin_notification'],
}

// ---------------------------------------------------------------------------
// Merge variables
// ---------------------------------------------------------------------------

export const MERGE_VARIABLES: Record<EmailType, readonly string[]> = {
  magic_link: ['otpCode', 'brandName'],
  staff_invite: ['inviteeName', 'brandName', 'acceptUrl'],
  assessment_invite: [
    'participantFirstName',
    'campaignTitle',
    'campaignDescription',
    'assessmentUrl',
    'brandName',
  ],
  assessment_reminder: [
    'participantFirstName',
    'campaignTitle',
    'assessmentUrl',
    'brandName',
    'daysRemaining',
  ],
  report_ready: ['recipientName', 'campaignTitle', 'reportUrl', 'brandName'],
  welcome: ['userName', 'brandName', 'loginUrl'],
  admin_notification: ['subject', 'message', 'actionUrl', 'actionLabel'],
}

// ---------------------------------------------------------------------------
// Sample variables (for preview and test sends)
// ---------------------------------------------------------------------------

export const SAMPLE_VARIABLES: Record<EmailType, Record<string, string | number>> = {
  magic_link: {
    otpCode: '384 291',
    brandName: 'Trajectas',
  },
  staff_invite: {
    inviteeName: 'Alex Johnson',
    brandName: 'Trajectas',
    acceptUrl: 'https://trajectas.com/auth/accept?invite=sample-token-abc123',
  },
  assessment_invite: {
    participantFirstName: 'Jordan',
    campaignTitle: 'Leadership Potential 2026',
    campaignDescription:
      'This assessment helps us understand your leadership strengths and development areas.',
    assessmentUrl: 'https://assess.trajectas.com/start?token=sample-token-def456',
    brandName: 'Trajectas',
  },
  assessment_reminder: {
    participantFirstName: 'Jordan',
    campaignTitle: 'Leadership Potential 2026',
    assessmentUrl: 'https://assess.trajectas.com/start?token=sample-token-def456',
    brandName: 'Trajectas',
    daysRemaining: 3,
  },
  report_ready: {
    recipientName: 'Sam Rivera',
    campaignTitle: 'Leadership Potential 2026',
    reportUrl: 'https://app.trajectas.com/reports/sample-report-id',
    brandName: 'Trajectas',
  },
  welcome: {
    userName: 'Taylor Kim',
    brandName: 'Trajectas',
    loginUrl: 'https://app.trajectas.com/login',
  },
  admin_notification: {
    subject: 'New integration request received',
    message:
      'Acme Corp has submitted a new integration request and requires your review.',
    actionUrl: 'https://admin.trajectas.com/integration-requests/sample-id',
    actionLabel: 'Review Request',
  },
}
