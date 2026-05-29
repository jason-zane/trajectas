'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCampaignAccess } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { logActionError } from '@/lib/security/action-errors'
import { mapCampaignRaterRow, mapCampaignParticipantRow } from '@/lib/supabase/mappers'
import type { CampaignParticipant, CampaignRater } from '@/types/database'

/** The subject is the single campaign_participant of a 360 campaign; raters rate them. */
export interface Campaign360Setup {
  subject: CampaignParticipant | null
  raters: CampaignRater[]
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

  // The subject is the campaign's single participant (one-subject 360).
  const { data: participants } = await db
    .from('campaign_participants')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
    .limit(1)

  const { data: raters, error } = await db
    .from('campaign_raters')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  return {
    subject: participants?.[0] ? mapCampaignParticipantRow(participants[0]) : null,
    raters: (raters ?? []).map(mapCampaignRaterRow),
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
  const { data, error } = await db
    .from('campaign_raters')
    .update({ status: 'invited', invited_at: new Date().toISOString() })
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
  revalidatePath(`/campaigns/${campaignId}/raters`)
  return { success: true as const, count: data?.length ?? 0 }
}
