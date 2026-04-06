'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  getCampaignAccessError,
  getParticipantAccessError,
} from '@/lib/assess/access'
import {
  ParticipantRuntimeAccessError,
  requireParticipantRuntimeCampaignAssessmentAccess,
  requireParticipantRuntimeSessionAccess,
} from '@/lib/auth/participant-runtime'
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

  const campaignAccessError = getCampaignAccessError({
    status: campaign.status,
    opensAt: campaign.opensAt,
    closesAt: campaign.closesAt,
  })
  if (campaignAccessError) {
    return { error: campaignAccessError.replace(/\.$/, "") }
  }

  const participantAccessError = getParticipantAccessError(participant.status)
  if (participantAccessError) {
    return { error: participantAccessError.replace(/\.$/, "") }
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
  token: string,
  campaignParticipantId: string,
  assessmentId: string,
  campaignId: string,
) {
  try {
    await requireParticipantRuntimeCampaignAssessmentAccess({
      token,
      participantId: campaignParticipantId,
      campaignId,
      assessmentId,
    })
  } catch (error) {
    if (error instanceof ParticipantRuntimeAccessError) {
      return { error: error.message }
    }
    throw error
  }

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

export async function getSessionState(token: string, sessionId: string) {
  try {
    await requireParticipantRuntimeSessionAccess(token, sessionId)
  } catch (error) {
    if (error instanceof ParticipantRuntimeAccessError) {
      return { error: error.message }
    }
    throw error
  }

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
  token,
  sessionId,
  itemId,
  sectionId,
  responseValue,
  responseData,
  responseTimeMs,
}: {
  token: string
  sessionId: string
  itemId: string
  sectionId?: string
  responseValue: number
  responseData?: Record<string, unknown>
  responseTimeMs?: number
}) {
  try {
    await requireParticipantRuntimeSessionAccess(token, sessionId)
  } catch (error) {
    if (error instanceof ParticipantRuntimeAccessError) {
      return { error: error.message }
    }
    throw error
  }

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
  token: string,
  sessionId: string,
  update: {
    currentSectionId?: string
    currentItemIndex?: number
    timeRemaining?: Record<string, number>
  },
) {
  let access: Awaited<ReturnType<typeof requireParticipantRuntimeSessionAccess>>
  try {
    access = await requireParticipantRuntimeSessionAccess(token, sessionId)
  } catch (error) {
    if (error instanceof ParticipantRuntimeAccessError) {
      return { error: error.message }
    }
    throw error
  }

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
    .eq('campaign_participant_id', access.participantId)

  if (error) return { error: error.message }
}

// ---------------------------------------------------------------------------
// Session completion
// ---------------------------------------------------------------------------

export async function submitSession(token: string, sessionId: string) {
  let access: Awaited<ReturnType<typeof requireParticipantRuntimeSessionAccess>>
  try {
    access = await requireParticipantRuntimeSessionAccess(token, sessionId)
  } catch (error) {
    if (error instanceof ParticipantRuntimeAccessError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()

  const { data: session, error: fetchErr } = await db
    .from('participant_sessions')
    .select('campaign_participant_id')
    .eq('id', sessionId)
    .eq('campaign_participant_id', access.participantId)
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
    .eq('campaign_participant_id', access.participantId)

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

  // Trigger report generation for any pending snapshots created by DB trigger.
  // Fire-and-forget — don't block the participant response.
  triggerReportGeneration(sessionId)

  return { success: true as const }
}

/**
 * Fire-and-forget: trigger report generation for all pending snapshots
 * created by the DB trigger after session completion.
 *
 * Uses internal API key to bypass admin auth since this runs in
 * participant context (no admin session).
 */
export async function triggerReportGeneration(sessionId: string): Promise<void> {
  const apiKey = process.env.INTERNAL_API_KEY
  if (!apiKey) {
    console.warn('[reports] INTERNAL_API_KEY not set — skipping auto-generation')
    return
  }

  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reports/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': apiKey,
      },
      body: JSON.stringify({ sessionId }),
    })
  } catch (error) {
    // Non-fatal — snapshots remain pending for manual retry
    console.error('[reports] Auto-generation trigger failed:', error)
  }
}

/**
 * Get the participant-facing report snapshot for completed sessions.
 * Called from the participant runtime — no admin auth required,
 * validated via access token ownership of the session.
 */
export async function getParticipantReportSnapshot(
  token: string,
): Promise<{ renderedData: unknown[]; status: string } | null> {
  const result = await validateAccessToken(token)
  if (result.error || !result.data) return null

  const completedSessions = result.data.sessions.filter(
    (s) => s.status === 'completed',
  )
  if (completedSessions.length === 0) return null

  const db = createAdminClient()
  const sessionIds = completedSessions.map((s) => s.id)

  const { data } = await db
    .from('report_snapshots')
    .select('rendered_data, status')
    .in('participant_session_id', sessionIds)
    .eq('audience_type', 'participant')
    .in('status', ['ready', 'released'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return { renderedData: data.rendered_data ?? [], status: data.status }
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
    .select('status, opens_at, closes_at, client_id')
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

  // Quota check: only applies when campaign belongs to a client
  if (campaign.client_id) {
    const { data: campaignAssessments } = await db
      .from('campaign_assessments')
      .select('assessment_id')
      .eq('campaign_id', link.campaign_id)

    const assessmentIds = (campaignAssessments ?? []).map((ca) => ca.assessment_id)

    if (assessmentIds.length > 0) {
      // Get assignments with quota limits for these assessments
      const { data: assignments } = await db
        .from('client_assessment_assignments')
        .select('*')
        .eq('client_id', campaign.client_id)
        .eq('is_active', true)
        .in('assessment_id', assessmentIds)

      for (const assignment of assignments ?? []) {
        if (assignment.quota_limit === null) continue

        const { data: usageData } = await db.rpc('get_assessment_quota_usage', {
          p_org_id: campaign.client_id,
          p_assessment_id: assignment.assessment_id,
        })

        const quotaUsed = typeof usageData === 'number' ? usageData : 0
        if (quotaUsed >= assignment.quota_limit) {
          return { error: 'This campaign is currently full.' }
        }
      }
    }
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
