'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCampaignAccess } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { logActionError } from '@/lib/security/action-errors'
import { mapCampaignRaterRow, mapCampaignParticipantRow } from '@/lib/supabase/mappers'
import { requireAppUrl } from '@/lib/hosts'
import type { CampaignParticipant, CampaignRater } from '@/types/database'

const RELATIONSHIP_EMAIL_LABEL: Record<string, string> = {
  manager: 'manager',
  peer: 'peer',
  direct_report: 'direct report',
  other: 'colleague',
}

/** A rater plus the live progress of their linked observer-survey participant. */
export interface RaterWithProgress extends CampaignRater {
  /** Access token for the rater's observer survey (once invited). */
  takingToken?: string
  /**
   * Display status: the rater lifecycle status, upgraded to in_progress /
   * completed from the linked participant once they start the survey.
   */
  effectiveStatus: string
}

/** The subject is the single campaign_participant of a 360 campaign; raters rate them. */
export interface Campaign360Setup {
  subject: CampaignParticipant | null
  raters: RaterWithProgress[]
}

const addRaterSchema = z.object({
  relationship: z.enum(['manager', 'peer', 'direct_report', 'other']),
  name: z.string().trim().max(200).optional(),
  email: z.string().trim().toLowerCase().email('A valid email is required'),
})

/**
 * Platform-admin gate for 360 rater management (test-bed scope). Reuses
 * campaign access resolution, then requires platform admin specifically.
 */
async function require360Admin(campaignId: string) {
  const access = await requireCampaignAccess(campaignId)
  if (!access.scope.isPlatformAdmin) {
    throw new Error('360 management is restricted to platform admins.')
  }
  return access
}

export async function getCampaign360Setup(
  campaignId: string,
): Promise<Campaign360Setup> {
  await require360Admin(campaignId)
  const db = createAdminClient()

  // The subject is the campaign's single NON-rater participant (one-subject 360).
  // Rater taking-rows also live in campaign_participants, so exclude them here.
  const { data: participants } = await db
    .from('campaign_participants')
    .select('*')
    .eq('campaign_id', campaignId)
    .is('campaign_rater_id', null)
    .order('created_at', { ascending: true })
    .limit(1)

  const [{ data: raters, error }, { data: raterParticipants }] = await Promise.all([
    db
      .from('campaign_raters')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true }),
    // The linked observer-survey participant rows carry the live taking status.
    db
      .from('campaign_participants')
      .select('campaign_rater_id, access_token, status')
      .eq('campaign_id', campaignId)
      .not('campaign_rater_id', 'is', null),
  ])

  if (error) throw new Error(error.message)

  const linkByRater = new Map(
    (raterParticipants ?? []).map((p) => [
      p.campaign_rater_id as string,
      { token: p.access_token as string, status: p.status as string },
    ]),
  )

  const augmented: RaterWithProgress[] = (raters ?? []).map((row) => {
    const rater = mapCampaignRaterRow(row)
    const link = linkByRater.get(rater.id)
    // Reflect the linked participant's live state: started (in_progress),
    // finished (completed), or token expired — so the UI doesn't offer a
    // reminder / link that the runtime would reject.
    let effectiveStatus = rater.status
    if (link?.status === 'completed') effectiveStatus = 'completed'
    else if (link?.status === 'in_progress') effectiveStatus = 'in_progress'
    else if (link?.status === 'expired') effectiveStatus = 'expired'
    return { ...rater, takingToken: link?.token, effectiveStatus }
  })

  return {
    subject: participants?.[0] ? mapCampaignParticipantRow(participants[0]) : null,
    raters: augmented,
  }
}

export async function addRater(
  campaignId: string,
  input: { relationship: string; name?: string; email?: string },
) {
  const access = await require360Admin(campaignId)
  const parsed = addRaterSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }
  const db = createAdminClient()

  const { data: subjectRows } = await db
    .from('campaign_participants')
    .select('id, email')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
    .limit(1)
  const subject = subjectRows?.[0]
  if (!subject) {
    return { error: { _form: ['Add the subject before adding raters.'] } }
  }

  // Integrity: the subject cannot rate themselves as an observer.
  if (parsed.data.email === String(subject.email).toLowerCase()) {
    return {
      error: { email: ['The subject cannot be one of their own raters.'] },
    }
  }

  // Admin-added raters are pre-approved (no separate approval step needed).
  const { data, error } = await db
    .from('campaign_raters')
    .insert({
      campaign_id: campaignId,
      subject_participant_id: subject.id,
      relationship: parsed.data.relationship,
      name: parsed.data.name || null,
      email: parsed.data.email,
      status: 'approved',
      approved_by: access.scope.actor?.id ?? null,
      approved_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    // Unique (subject, email) violation → friendly message.
    if (error.code === '23505') {
      return { error: { email: ['This person is already a rater for the subject.'] } }
    }
    logActionError('addRater', error)
    return { error: { _form: ['Unable to add rater.'] } }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.rater.added',
    targetTable: 'campaign_raters',
    targetId: data.id,
    metadata: { campaignId, relationship: parsed.data.relationship },
  })
  revalidatePath(`/campaigns/${campaignId}/raters`)
  return { success: true as const, id: data.id }
}

export async function updateRaterStatus(
  campaignId: string,
  raterId: string,
  status: 'approved' | 'declined' | 'withdrawn',
) {
  const access = await require360Admin(campaignId)
  const db = createAdminClient()
  const patch: Record<string, unknown> = { status }
  if (status === 'approved') {
    patch.approved_by = access.scope.actor?.id ?? null
    patch.approved_at = new Date().toISOString()
  }
  const { error } = await db
    .from('campaign_raters')
    .update(patch)
    .eq('id', raterId)
    .eq('campaign_id', campaignId)
  if (error) {
    logActionError('updateRaterStatus', error)
    return { error: 'Unable to update rater.' }
  }

  // Declining/withdrawing a rater must revoke their survey access. The runner
  // authorizes from campaign_participants.status (blocking withdrawn/expired),
  // so propagate to the linked observer-survey participant row — otherwise a
  // declined rater could still submit via a previously-shared link.
  if (status === 'declined' || status === 'withdrawn') {
    const { error: revokeErr } = await db
      .from('campaign_participants')
      .update({ status: 'withdrawn' })
      .eq('campaign_id', campaignId)
      .eq('campaign_rater_id', raterId)
    if (revokeErr) {
      logActionError('updateRaterStatus.revokeAccess', revokeErr)
    }
  }

  revalidatePath(`/campaigns/${campaignId}/raters`)
  return { success: true as const }
}

export async function removeRater(campaignId: string, raterId: string) {
  await require360Admin(campaignId)
  const db = createAdminClient()
  const { error } = await db
    .from('campaign_raters')
    .delete()
    .eq('id', raterId)
    .eq('campaign_id', campaignId)
  if (error) {
    logActionError('removeRater', error)
    return { error: 'Unable to remove rater.' }
  }
  revalidatePath(`/campaigns/${campaignId}/raters`)
  return { success: true as const }
}

/**
 * Mark all approved raters as invited (test-bed: the admin shares each rater's
 * access link from the table; email delivery is wired in a later phase).
 */
export async function markApprovedRatersInvited(campaignId: string) {
  const access = await require360Admin(campaignId)
  const db = createAdminClient()
  const now = new Date().toISOString()

  // Approved raters that don't yet have an observer-survey participant row.
  const { data: approved, error: approvedErr } = await db
    .from('campaign_raters')
    .select('id, email, name, relationship')
    .eq('campaign_id', campaignId)
    .eq('status', 'approved')
  if (approvedErr) {
    logActionError('markApprovedRatersInvited.select', approvedErr)
    return { error: 'Unable to mark raters invited.' }
  }
  if (!approved || approved.length === 0) {
    return { success: true as const, count: 0 }
  }

  const { data: existing } = await db
    .from('campaign_participants')
    .select('campaign_rater_id')
    .eq('campaign_id', campaignId)
    .in('campaign_rater_id', approved.map((r) => r.id))
  const hasParticipant = new Set(
    (existing ?? []).map((p) => p.campaign_rater_id as string),
  )

  const toCreate = approved.filter((r) => !hasParticipant.has(r.id))
  if (toCreate.length > 0) {
    // Create one observer-survey participant per rater (access_token defaulted).
    const { error: insertErr } = await db.from('campaign_participants').insert(
      toCreate.map((r) => ({
        campaign_id: campaignId,
        email: r.email,
        campaign_rater_id: r.id,
        status: 'invited',
        invited_at: now,
      })),
    )
    if (insertErr) {
      logActionError('markApprovedRatersInvited.insert', insertErr)
      return { error: 'Unable to create rater survey access.' }
    }
  }

  const { data, error } = await db
    .from('campaign_raters')
    .update({ status: 'invited', invited_at: now })
    .eq('campaign_id', campaignId)
    .eq('status', 'approved')
    .select('id')
  if (error) {
    logActionError('markApprovedRatersInvited', error)
    return { error: 'Unable to mark raters invited.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.raters.invited',
    targetTable: 'campaign_raters',
    targetId: campaignId,
    metadata: { count: data?.length ?? 0 },
  })

  // Send each rater their invitation email (best-effort — a send failure must
  // not roll back the invite; the admin can still copy the link from the table).
  const emailResult = await sendRaterInviteEmails(
    db,
    campaignId,
    approved.map((r) => ({
      id: r.id as string,
      name: (r.name as string | null) ?? null,
      relationship: r.relationship as string,
    })),
  )

  revalidatePath(`/campaigns/${campaignId}/raters`)
  return {
    success: true as const,
    count: data?.length ?? 0,
    emailsSent: emailResult.sent,
  }
}

export interface SendRemindersResult {
  sent: number
  error?: string
}

/**
 * Send a reminder email to the given raters (manual nudge from the Subject &
 * Raters tab). Only raters who have been invited and haven't completed/withdrawn
 * are reminded; their last_reminded_at is stamped. Best-effort per recipient.
 */
export async function sendRaterReminders(
  campaignId: string,
  raterIds: string[],
): Promise<SendRemindersResult> {
  const access = await require360Admin(campaignId)
  const db = createAdminClient()
  const ids = Array.from(new Set(raterIds))
  if (ids.length === 0) return { sent: 0 }

  const [{ data: campaign }, { data: subjectRows }, { data: raterRows }, { data: parts }] =
    await Promise.all([
      db
        .from('campaigns')
        .select('title, client_id, partner_id')
        .eq('id', campaignId)
        .single(),
      db
        .from('campaign_participants')
        .select('first_name, last_name')
        .eq('campaign_id', campaignId)
        .is('campaign_rater_id', null)
        .order('created_at', { ascending: true })
        .limit(1),
      db
        .from('campaign_raters')
        .select('id, name')
        .eq('campaign_id', campaignId)
        .in('id', ids),
      db
        .from('campaign_participants')
        .select('campaign_rater_id, email, access_token, status')
        .eq('campaign_id', campaignId)
        .in('campaign_rater_id', ids),
    ])

  const subject = subjectRows?.[0]
  const subjectName = subject
    ? [subject.first_name, subject.last_name].filter(Boolean).join(' ') ||
      'your colleague'
    : 'your colleague'
  const nameByRater = new Map(
    (raterRows ?? []).map((r) => [r.id as string, (r.name as string | null) ?? '']),
  )
  const linkByRater = new Map(
    (parts ?? []).map((p) => [
      p.campaign_rater_id as string,
      {
        token: p.access_token as string,
        email: p.email as string,
        status: p.status as string,
      },
    ]),
  )

  const assessBaseUrl = requireAppUrl('public')
  const { sendEmail } = await import('@/lib/email/send')

  const remindedIds: string[] = []
  for (const id of ids) {
    const link = linkByRater.get(id)
    // Only nudge people who can still respond — completed, withdrawn, and
    // expired tokens are rejected by the assessment runtime, so a reminder
    // would point them at an unusable link.
    if (
      !link ||
      link.status === 'completed' ||
      link.status === 'withdrawn' ||
      link.status === 'expired'
    ) {
      continue
    }
    try {
      await sendEmail({
        type: 'rater_reminder',
        to: link.email,
        variables: {
          raterName: nameByRater.get(id) ?? '',
          subjectName,
          assessmentUrl: `${assessBaseUrl}/assess/${link.token}`,
          brandName: 'Trajectas',
        },
        scopeCampaignId: campaignId,
        scopeClientId: campaign?.client_id ?? undefined,
        scopePartnerId: campaign?.partner_id ?? undefined,
      })
      remindedIds.push(id)
    } catch (err) {
      logActionError('sendRaterReminders', err)
    }
  }

  if (remindedIds.length > 0) {
    await db
      .from('campaign_raters')
      .update({ last_reminded_at: new Date().toISOString() })
      .in('id', remindedIds)
    await logAuditEvent({
      actorProfileId: access.scope.actor?.id ?? null,
      eventType: 'campaign.raters.reminded',
      targetTable: 'campaign_raters',
      targetId: campaignId,
      metadata: { count: remindedIds.length },
    })
  }

  revalidatePath(`/campaigns/${campaignId}/raters`)
  return { sent: remindedIds.length }
}

/**
 * Email approved raters their observer-survey link. Resolves each rater's linked
 * participant token + the subject's name, then sends the `rater_invite` template.
 * Best-effort per recipient.
 */
async function sendRaterInviteEmails(
  db: ReturnType<typeof createAdminClient>,
  campaignId: string,
  raters: { id: string; name: string | null; relationship: string }[],
): Promise<{ sent: number }> {
  if (raters.length === 0) return { sent: 0 }

  const [{ data: campaign }, { data: subjectRows }, { data: raterParticipants }] =
    await Promise.all([
      db
        .from('campaigns')
        .select('title, client_id, partner_id')
        .eq('id', campaignId)
        .single(),
      db
        .from('campaign_participants')
        .select('first_name, last_name, email')
        .eq('campaign_id', campaignId)
        .is('campaign_rater_id', null)
        .order('created_at', { ascending: true })
        .limit(1),
      db
        .from('campaign_participants')
        .select('campaign_rater_id, email, access_token')
        .eq('campaign_id', campaignId)
        .in(
          'campaign_rater_id',
          raters.map((r) => r.id),
        ),
    ])

  const subject = subjectRows?.[0]
  const subjectName = subject
    ? [subject.first_name, subject.last_name].filter(Boolean).join(' ') ||
      'your colleague'
    : 'your colleague'

  const tokenByRater = new Map(
    (raterParticipants ?? []).map((p) => [
      p.campaign_rater_id as string,
      { token: p.access_token as string, email: p.email as string },
    ]),
  )

  const assessBaseUrl = requireAppUrl('public')
  const { sendEmail } = await import('@/lib/email/send')

  let sent = 0
  for (const rater of raters) {
    const link = tokenByRater.get(rater.id)
    if (!link) continue
    try {
      await sendEmail({
        type: 'rater_invite',
        to: link.email,
        variables: {
          raterName: rater.name ?? '',
          subjectName,
          relationshipLabel:
            RELATIONSHIP_EMAIL_LABEL[rater.relationship] ?? 'colleague',
          assessmentUrl: `${assessBaseUrl}/assess/${link.token}`,
          brandName: 'Trajectas',
        },
        scopeCampaignId: campaignId,
        scopeClientId: campaign?.client_id ?? undefined,
        scopePartnerId: campaign?.partner_id ?? undefined,
      })
      sent += 1
    } catch (err) {
      logActionError('sendRaterInviteEmails', err)
    }
  }
  return { sent }
}
