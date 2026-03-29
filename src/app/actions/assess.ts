'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { scoreSessionCTT } from '@/lib/scoring/ctt-session'
import {
  mapCampaignRow,
  mapCampaignParticipantRow,
  mapCampaignAssessmentRow,
} from '@/lib/supabase/mappers'
import type {
  Campaign,
  CampaignParticipant,
  CampaignAssessment,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AssessmentForRunner = {
  id: string
  title: string
  description?: string
  sectionCount: number
}

export type SessionForRunner = {
  id: string
  assessmentId: string
  status: string
  currentSectionId?: string
  currentItemIndex: number
  startedAt?: string
  completedAt?: string
}

export type TokenValidationResult = {
  campaign: Campaign
  participant: CampaignParticipant
  assessments: (CampaignAssessment & AssessmentForRunner)[]
  sessions: SessionForRunner[]
}

export type SectionForRunner = {
  id: string
  title: string
  instructions?: string
  displayOrder: number
  responseFormatId: string
  responseFormatType: string
  responseFormatConfig: Record<string, unknown>
  itemOrdering: string
  itemsPerPage?: number
  timeLimitSeconds?: number
  allowBackNav: boolean
  items: ItemForRunner[]
}

export type ItemForRunner = {
  id: string
  stem: string
  displayOrder: number
  options: { id: string; label: string; value: number; sortOrder: number }[]
}

// ---------------------------------------------------------------------------
// Token validation
// ---------------------------------------------------------------------------

export async function validateAccessToken(
  token: string,
): Promise<{ data?: TokenValidationResult; error?: string }> {
  const db = createAdminClient()

  // Find participant by token
  const { data: participantRow, error: participantErr } = await db
    .from('campaign_participants')
    .select('*')
    .eq('access_token', token)
    .single()

  if (participantErr || !participantRow) {
    return { error: 'Invalid or expired access link' }
  }

  const participant = mapCampaignParticipantRow(participantRow)

  // Load campaign
  const { data: campaignRow, error: campaignErr } = await db
    .from('campaigns')
    .select('*')
    .eq('id', participant.campaignId)
    .is('deleted_at', null)
    .single()

  if (campaignErr || !campaignRow) {
    return { error: 'Campaign not found' }
  }

  const campaign = mapCampaignRow(campaignRow)

  // Check campaign status
  if (!['active', 'paused'].includes(campaign.status)) {
    return { error: 'This campaign is not currently accepting responses' }
  }

  // Check access window
  const now = new Date()
  if (campaign.opensAt && new Date(campaign.opensAt) > now) {
    return { error: 'This campaign has not opened yet' }
  }
  if (campaign.closesAt && new Date(campaign.closesAt) < now) {
    return { error: 'This campaign has closed' }
  }

  // Check participant status
  if (['withdrawn', 'expired'].includes(participant.status)) {
    return { error: 'Your access to this campaign has been revoked' }
  }

  // Load campaign assessments
  const { data: caRows } = await db
    .from('campaign_assessments')
    .select('*, assessments(id, name, description, assessment_sections(count))')
    .eq('campaign_id', campaign.id)
    .order('display_order', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assessments = (caRows ?? []).map((r: any) => ({
    ...mapCampaignAssessmentRow(r),
    id: r.assessments?.id ?? r.assessment_id,
    title: r.assessments?.name ?? 'Untitled',
    description: r.assessments?.description ?? undefined,
    sectionCount: r.assessments?.assessment_sections?.[0]?.count ?? 0,
  }))

  // Load existing sessions for this participant
  const { data: sessionRows } = await db
    .from('participant_sessions')
    .select('*')
    .eq('campaign_participant_id', participant.id)

  const sessions: SessionForRunner[] = (sessionRows ?? []).map((s) => ({
    id: s.id,
    assessmentId: s.assessment_id,
    status: s.status,
    currentSectionId: s.current_section_id ?? undefined,
    currentItemIndex: s.current_item_index ?? 0,
    startedAt: s.started_at ?? undefined,
    completedAt: s.completed_at ?? undefined,
  }))

  return {
    data: { campaign, participant, assessments, sessions },
  }
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export async function startSession(
  campaignParticipantId: string,
  assessmentId: string,
  campaignId: string,
) {
  const db = createAdminClient()

  // Check for existing session
  const { data: existing } = await db
    .from('participant_sessions')
    .select('id')
    .eq('campaign_participant_id', campaignParticipantId)
    .eq('assessment_id', assessmentId)
    .single()

  if (existing) {
    return { id: existing.id }
  }

  // Create new session
  const { data: session, error } = await db
    .from('participant_sessions')
    .insert({
      assessment_id: assessmentId,
      campaign_id: campaignId,
      campaign_participant_id: campaignParticipantId,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Update participant status to in_progress
  await db
    .from('campaign_participants')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .eq('id', campaignParticipantId)
    .eq('status', 'invited')

  return { id: session.id }
}

export async function getSessionState(sessionId: string) {
  const db = createAdminClient()

  const { data: session, error } = await db
    .from('participant_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (error || !session) return { error: 'Session not found' }

  // Load sections with items
  const { data: sectionRows } = await db
    .from('assessment_sections')
    .select(`
      *,
      response_formats(type, config),
      assessment_section_items(
        id,
        item_id,
        display_order,
        items(id, stem, item_options(id, label, value, display_order))
      )
    `)
    .eq('assessment_id', session.assessment_id)
    .order('display_order', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sections: SectionForRunner[] = (sectionRows ?? []).map((s: any) => ({
    id: s.id,
    title: s.title,
    instructions: s.instructions ?? undefined,
    displayOrder: s.display_order,
    responseFormatId: s.response_format_id,
    responseFormatType: s.response_formats?.type ?? 'likert',
    responseFormatConfig: s.response_formats?.config ?? {},
    itemOrdering: s.item_ordering,
    itemsPerPage: s.items_per_page ?? undefined,
    timeLimitSeconds: s.time_limit_seconds ?? undefined,
    allowBackNav: s.allow_back_nav,
    items: (s.assessment_section_items ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => a.display_order - b.display_order)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((si: any) => ({
        id: si.items?.id ?? si.item_id,
        stem: si.items?.stem ?? '',
        displayOrder: si.display_order,
        options: (si.items?.item_options ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .sort((a: any, b: any) => a.display_order - b.display_order)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((o: any) => ({
            id: o.id,
            label: o.label,
            value: o.value,
            sortOrder: o.display_order,
          })),
      })),
  }))

  // Load existing responses
  const { data: responseRows } = await db
    .from('participant_responses')
    .select('item_id, response_value, response_data')
    .eq('session_id', sessionId)

  const responses: Record<string, { value: number; data: Record<string, unknown> }> = {}
  for (const r of responseRows ?? []) {
    responses[r.item_id] = {
      value: Number(r.response_value),
      data: r.response_data ?? {},
    }
  }

  return {
    data: {
      sessionId: session.id,
      assessmentId: session.assessment_id,
      status: session.status,
      currentSectionId: session.current_section_id ?? undefined,
      currentItemIndex: session.current_item_index ?? 0,
      timeRemaining: session.time_remaining_seconds ?? {},
      sections,
      responses,
    },
  }
}

// ---------------------------------------------------------------------------
// Response saving (Zone 1 — immediate)
// ---------------------------------------------------------------------------

export async function saveResponse({
  sessionId,
  itemId,
  sectionId,
  responseValue,
  responseData,
  responseTimeMs,
}: {
  sessionId: string
  itemId: string
  sectionId?: string
  responseValue: number
  responseData?: Record<string, unknown>
  responseTimeMs?: number
}) {
  const db = createAdminClient()

  const { error } = await db
    .from('participant_responses')
    .upsert(
      {
        session_id: sessionId,
        item_id: itemId,
        section_id: sectionId ?? null,
        response_value: responseValue,
        response_data: responseData ?? {},
        response_time_ms: responseTimeMs ?? null,
      },
      { onConflict: 'session_id,item_id' },
    )

  if (error) return { error: error.message }
  return { success: true as const }
}

// ---------------------------------------------------------------------------
// Navigation / progress
// ---------------------------------------------------------------------------

export async function updateSessionProgress(
  sessionId: string,
  update: {
    currentSectionId?: string
    currentItemIndex?: number
    timeRemaining?: Record<string, number>
  },
) {
  const db = createAdminClient()

  const patch: Record<string, unknown> = {}
  if (update.currentSectionId !== undefined)
    patch.current_section_id = update.currentSectionId
  if (update.currentItemIndex !== undefined)
    patch.current_item_index = update.currentItemIndex
  if (update.timeRemaining !== undefined)
    patch.time_remaining_seconds = update.timeRemaining

  const { error } = await db
    .from('participant_sessions')
    .update(patch)
    .eq('id', sessionId)

  if (error) return { error: error.message }
}

// ---------------------------------------------------------------------------
// Session completion
// ---------------------------------------------------------------------------

export async function submitSession(sessionId: string) {
  const db = createAdminClient()

  const { data: session, error: fetchErr } = await db
    .from('participant_sessions')
    .select('campaign_participant_id')
    .eq('id', sessionId)
    .single()

  if (fetchErr) return { error: fetchErr.message }

  // Mark session complete
  const { error: updateErr } = await db
    .from('participant_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (updateErr) return { error: updateErr.message }

  // Run CTT scoring (synchronous — simple mean POMP per factor)
  await scoreSessionCTT(sessionId)

  // Check if all required assessments are complete
  if (session.campaign_participant_id) {
    const { data: participantRow } = await db
      .from('campaign_participants')
      .select('campaign_id')
      .eq('id', session.campaign_participant_id)
      .single()

    if (participantRow) {
      // Get required assessments
      const { data: required } = await db
        .from('campaign_assessments')
        .select('assessment_id')
        .eq('campaign_id', participantRow.campaign_id)
        .eq('is_required', true)

      const requiredIds = new Set((required ?? []).map((r) => r.assessment_id))

      // Get completed sessions for this participant
      const { data: completed } = await db
        .from('participant_sessions')
        .select('assessment_id')
        .eq('campaign_participant_id', session.campaign_participant_id)
        .eq('status', 'completed')

      const completedIds = new Set((completed ?? []).map((s) => s.assessment_id))

      const allDone = [...requiredIds].every((id) => completedIds.has(id))

      if (allDone) {
        await db
          .from('campaign_participants')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', session.campaign_participant_id)
      }
    }
  }

  return { success: true as const }
}

// ---------------------------------------------------------------------------
// Open enrollment (join via access link)
// ---------------------------------------------------------------------------

export async function registerViaLink(
  linkToken: string,
  { email, firstName, lastName, marketingConsent }: {
    email: string
    firstName?: string
    lastName?: string
    marketingConsent?: boolean
  },
) {
  const db = createAdminClient()

  // Validate link
  const { data: link, error: linkErr } = await db
    .from('campaign_access_links')
    .select('*')
    .eq('token', linkToken)
    .eq('is_active', true)
    .single()

  if (linkErr || !link) {
    return { error: 'Invalid or expired enrollment link' }
  }

  // Check max uses
  if (link.max_uses && link.use_count >= link.max_uses) {
    return { error: 'This enrollment link has reached its maximum uses' }
  }

  // Check expiry
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { error: 'This enrollment link has expired' }
  }

  // Check campaign status
  const { data: campaign } = await db
    .from('campaigns')
    .select('status, opens_at, closes_at')
    .eq('id', link.campaign_id)
    .is('deleted_at', null)
    .single()

  if (!campaign || !['active'].includes(campaign.status)) {
    return { error: 'This campaign is not currently accepting registrations' }
  }

  // Create or find participant
  const { data: existing } = await db
    .from('campaign_participants')
    .select('id, access_token')
    .eq('campaign_id', link.campaign_id)
    .eq('email', email.toLowerCase())
    .single()

  if (existing) {
    // Already registered — return their token
    return { accessToken: existing.access_token }
  }

  // Create new participant
  const { data: newParticipant, error: insertErr } = await db
    .from('campaign_participants')
    .insert({
      campaign_id: link.campaign_id,
      email: email.toLowerCase(),
      first_name: firstName ?? null,
      last_name: lastName ?? null,
      status: 'registered',
      ...(marketingConsent ? { marketing_consent_given_at: new Date().toISOString() } : {}),
    })
    .select('access_token')
    .single()

  if (insertErr) return { error: insertErr.message }

  // Increment link use count
  await db
    .from('campaign_access_links')
    .update({ use_count: link.use_count + 1 })
    .eq('id', link.id)

  return { accessToken: newParticipant.access_token }
}
