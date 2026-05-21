'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'

const GRACE_PERIOD_DAYS = 30

export interface AccountDeletionResult {
  success?: boolean
  error?: string
  scheduledDeletionAt?: string
}

async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * Request account deletion. Marks the profile with a request timestamp
 * and a scheduled hard-delete timestamp 30 days out. The user can cancel
 * by calling cancelAccountDeletion at any time during the grace period.
 *
 * The user is NOT signed out and NOT blocked from logging in — that's
 * intentional so they can still come back and cancel.
 */
export async function requestAccountDeletion(): Promise<AccountDeletionResult> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return { error: 'Not authenticated' }

  const db = createAdminClient()
  const now = new Date()
  const scheduledFor = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)

  const { data: profile, error: updateError } = await db
    .from('profiles')
    .update({
      deletion_requested_at: now.toISOString(),
      scheduled_deletion_at: scheduledFor.toISOString(),
    })
    .eq('id', userId)
    .select('email, scheduled_deletion_at')
    .single()

  if (updateError || !profile) {
    return { error: updateError?.message ?? 'Failed to schedule deletion' }
  }

  // Best-effort confirmation email. Don't fail the action if email send
  // fails — the user has already requested deletion and the timestamps
  // are the source of truth. Surface the issue in logs only.
  try {
    await sendEmail({
      type: 'admin_notification',
      to: profile.email,
      variables: {
        subject: 'Your Trajectas account is scheduled for deletion',
        message: `You have requested deletion of your Trajectas account. We will permanently delete your account and associated data on ${formatDate(scheduledFor)}.\n\nIf you change your mind, sign in to Trajectas and cancel the deletion from your profile page. You have ${GRACE_PERIOD_DAYS} days.`,
        actionUrl: `${publicAppUrl()}/profile`,
        actionLabel: 'Cancel deletion',
      },
    })
  } catch (emailError) {
    console.error('[account-deletion] confirmation email failed:', emailError)
  }

  revalidatePath('/profile')
  return { success: true, scheduledDeletionAt: profile.scheduled_deletion_at }
}

/**
 * Cancel a pending account-deletion request. No-op if there is no
 * pending request.
 */
export async function cancelAccountDeletion(): Promise<AccountDeletionResult> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return { error: 'Not authenticated' }

  const db = createAdminClient()
  const { data: profile, error: updateError } = await db
    .from('profiles')
    .update({
      deletion_requested_at: null,
      scheduled_deletion_at: null,
    })
    .eq('id', userId)
    .select('email')
    .single()

  if (updateError || !profile) {
    return { error: updateError?.message ?? 'Failed to cancel deletion' }
  }

  try {
    await sendEmail({
      type: 'admin_notification',
      to: profile.email,
      variables: {
        subject: 'Your Trajectas account deletion was cancelled',
        message:
          'Your scheduled account deletion has been cancelled. No action will be taken and your account remains active.',
        actionUrl: `${publicAppUrl()}/profile`,
        actionLabel: 'Open profile',
      },
    })
  } catch (emailError) {
    console.error('[account-deletion] cancellation email failed:', emailError)
  }

  revalidatePath('/profile')
  return { success: true }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function publicAppUrl(): string {
  return (
    process.env.PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3002'
  )
}
