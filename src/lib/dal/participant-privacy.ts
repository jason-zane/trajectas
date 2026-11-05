import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { postgresUuid } from '@/lib/validations/uuid'
import type { ParticipantPrivacyNotice } from '@/lib/privacy/notice'

export type ParticipantPrivacyState = {
  notice: ParticipantPrivacyNotice & { version: string; hash: string }
  acknowledged: boolean
}

/** Internal to enrollment routes/actions after validating the campaign access link. */
export async function getEnrollmentPrivacyNotice(campaignId: string): Promise<ParticipantPrivacyNotice | null> {
  postgresUuid().parse(campaignId)
  const db = createAdminClient()
  const { data: settings, error } = await db.from('campaign_privacy_settings')
    .select('notice_version_id,notice_effective_at').eq('campaign_id', campaignId).maybeSingle()
  if (error) throw new Error('Assessment privacy information is unavailable.')
  if (!settings?.notice_version_id || new Date(settings.notice_effective_at) > new Date()) return null
  const { data: notice, error: noticeError } = await db.from('privacy_notice_versions')
    .select('id,title,body,acknowledgement_label,research_label,research_choice_enabled')
    .eq('id', settings.notice_version_id).eq('status', 'published').eq('audience', 'participant').single()
  if (noticeError || !notice) throw new Error('Assessment privacy information is unavailable.')
  return { id: notice.id, title: notice.title, body: notice.body, acknowledgementLabel: notice.acknowledgement_label,
    researchLabel: notice.research_label, researchChoiceEnabled: notice.research_choice_enabled }
}

/** Internal to token-validated participant routes; no user identifiers are returned. */
export const getParticipantPrivacyState = cache(async (
  participantId: string,
  campaignId: string,
): Promise<ParticipantPrivacyState | null> => {
  postgresUuid().parse(participantId); postgresUuid().parse(campaignId)
  const db = createAdminClient()
  const [{ data: settings, error }, { data: participant, error: participantError }] = await Promise.all([
    db.from('campaign_privacy_settings').select('notice_version_id,notice_effective_at').eq('campaign_id', campaignId).maybeSingle(),
    db.from('campaign_participants').select('created_at').eq('id', participantId).eq('campaign_id', campaignId).is('deleted_at', null).maybeSingle(),
  ])
  if (error || participantError) throw new Error('Assessment privacy information is unavailable.')
  if (!participant) throw new Error('Assessment participant is unavailable.')
  if (!settings?.notice_version_id || new Date(participant.created_at) < new Date(settings.notice_effective_at)) return null
  const noticeResult = await db.from('privacy_notice_versions').select('id,title,body,version,body_hash,acknowledgement_label,research_label,research_choice_enabled')
    .eq('id', settings.notice_version_id).eq('status', 'published').single()
  if (noticeResult.error || !noticeResult.data) throw new Error('Assessment privacy information is unavailable.')
  const n = noticeResult.data
  const receipt = await db.from('participant_privacy_receipts').select('id').eq('participant_id', participantId)
    .eq('notice_version_id', n.id).eq('notice_hash', n.body_hash).eq('purpose', 'assessment_notice').eq('accepted', true).limit(1)
  if (receipt.error) throw new Error('Assessment privacy acknowledgement is unavailable.')
  return {
    notice: { id: n.id, title: n.title, body: n.body, version: n.version, hash: n.body_hash, acknowledgementLabel: n.acknowledgement_label, researchLabel: n.research_label, researchChoiceEnabled: n.research_choice_enabled },
    acknowledged: Boolean(receipt.data?.length),
  }
})
