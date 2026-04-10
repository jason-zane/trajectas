'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { logReportViewed } from '@/lib/auth/support-sessions'
import { logActionError } from '@/lib/security/action-errors'
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
import { getItemsPerConstructForCount } from '@/app/actions/item-selection-rules'
import {
  mapCampaignRow,
  mapCampaignParticipantRow,
  mapCampaignAssessmentRow,
} from '@/lib/supabase/mappers'
import { enqueueAssessmentCompletedEvent } from '@/lib/integrations/events'
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

type SectionOptionRow = {
  id: string
  label: string
  value: number
  display_order: number
}

type SectionItemRow = {
  id: string
  stem: string
  construct_id: string | null
  purpose: string | null
  selection_priority: number | null
  item_options: SectionOptionRow[] | null
} | null

type AssessmentSectionItemRow = {
  id: string
  item_id: string
  display_order: number
  items: SectionItemRow
}

type AssessmentSectionResponseFormatRow = {
  type: string | null
  config: Record<string, unknown> | null
} | null

type AssessmentSectionRow = {
  id: string
  title: string
  instructions: string | null
  display_order: number
  response_format_id: string
  item_ordering: string
  items_per_page: number | null
  time_limit_seconds: number | null
  allow_back_nav: boolean
  response_formats: AssessmentSectionResponseFormatRow
  assessment_section_items: AssessmentSectionItemRow[] | null
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
  const { data: caRows, error: campaignAssessmentsError } = await db
    .from('campaign_assessments')
    .select('*, assessments(id, title, description, assessment_sections(count))')
    .eq('campaign_id', campaign.id)
    .order('display_order', { ascending: true })

  if (campaignAssessmentsError) {
    logActionError('validateAccessToken.campaignAssessments', campaignAssessmentsError)
    return { error: 'Unable to load this assessment right now' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assessments = (caRows ?? []).map((r: any) => ({
    ...mapCampaignAssessmentRow(r),
    id: r.assessments?.id ?? r.assessment_id,
    title: r.assessments?.title ?? 'Untitled',
    description: r.assessments?.description ?? undefined,
    sectionCount: r.assessments?.assessment_sections?.[0]?.count ?? 0,
  }))

  // Load existing sessions for this participant
  const { data: sessionRows, error: sessionRowsError } = await db
    .from('participant_sessions')
    .select('*')
    .eq('campaign_participant_id', participant.id)

  if (sessionRowsError) {
    logActionError('validateAccessToken.sessions', sessionRowsError)
    return { error: 'Unable to load this assessment right now' }
  }

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

  if (error) {
    logActionError('startSession.insert', error)
    return { error: 'Unable to start this assessment right now' }
  }

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

  // Fan out all queries that depend only on session.assessment_id / session.campaign_id
  // in parallel. Previously these ran sequentially (4+ round-trips).
  const [sectionResult, campaignAssessmentResult, assessmentFactorsResult] =
    await Promise.all([
      db
        .from('assessment_sections')
        .select(`
          *,
          response_formats(type, config),
          assessment_section_items(
            id,
            item_id,
            display_order,
            items(id, stem, construct_id, purpose, selection_priority, item_options(id, label, value, display_order))
          )
        `)
        .eq('assessment_id', session.assessment_id)
        .order('display_order', { ascending: true }),
      db
        .from('campaign_assessments')
        .select('id')
        .eq('campaign_id', session.campaign_id)
        .eq('assessment_id', session.assessment_id)
        .maybeSingle(),
      db
        .from('assessment_factors')
        .select('factor_id')
        .eq('assessment_id', session.assessment_id),
    ])

  const { data: sectionRows, error: sectionRowsError } = sectionResult
  if (sectionRowsError) {
    logActionError('getSessionState.sections', sectionRowsError)
    return { error: 'Unable to load this assessment right now' }
  }

  const campaignAssessment = campaignAssessmentResult.data
  const assessmentFactorIds = assessmentFactorsResult.data

  // -------------------------------------------------------------------------
  // Resolve custom factor selection for this campaign-assessment
  // -------------------------------------------------------------------------
  let allowedConstructIds: Set<string> | null = null
  let itemsPerConstruct: number | null = null

  if (campaignAssessment) {
    const { data: factorRows } = await db
      .from('campaign_assessment_factors')
      .select('factor_id')
      .eq('campaign_assessment_id', campaignAssessment.id)

    if (factorRows && factorRows.length > 0) {
      const selectedFactorIds = new Set(factorRows.map(r => r.factor_id))

      const assessmentFactorSet = new Set(
        (assessmentFactorIds ?? []).map(af => af.factor_id)
      )

      const { data: fcLinks } = await db
        .from('factor_constructs')
        .select('construct_id, factor_id')
        .in('factor_id', Array.from(assessmentFactorSet))

      if (fcLinks) {
        allowedConstructIds = new Set(
          fcLinks
            .filter(fc => selectedFactorIds.has(fc.factor_id))
            .map(fc => fc.construct_id)
        )

        // Look up items-per-construct limit from the item_selection_rules table
        itemsPerConstruct = await getItemsPerConstructForCount(allowedConstructIds.size)
      }
    }
  }

  const sections: SectionForRunner[] = ((sectionRows ?? []) as AssessmentSectionRow[]).map((s) => {
    const formatConfig = s.response_formats?.config ?? {}
    const formatType = s.response_formats?.type ?? 'likert'

    // Derive fallback options from response format anchors when item_options is empty.
    // This handles AI-generated items that have stems but no per-item options.
    function deriveOptionsFromFormat() {
      const anchors = formatConfig.anchors
      if (formatType === 'likert' && anchors && typeof anchors === 'object') {
        return Object.entries(anchors)
          .map(([val, label]) => ({
            id: `rf-${val}`,
            label: String(label),
            value: Number(val),
            sortOrder: Number(val),
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder)
      }
      return []
    }

    const fallbackOptions = deriveOptionsFromFormat()

    // Sort section items by display_order first
    let sectionItems = [...(s.assessment_section_items ?? [])]
      .sort((a, b) => a.display_order - b.display_order)

    // Filter items by campaign factor selection when active
    if (allowedConstructIds) {
      sectionItems = sectionItems.filter((si) => {
        const item = si.items
        // Always include non-construct items (attention checks, impression management, infrequency)
        if (item?.purpose && item.purpose !== 'construct') return true
        // Include if construct belongs to a selected factor
        return item?.construct_id && allowedConstructIds!.has(item.construct_id)
      })

      // Apply per-construct item count scaling
      if (itemsPerConstruct !== null) {
        // Sort construct items by selection_priority (lower = higher priority)
        // within each construct group, then apply limit
        const constructItemCounts = new Map<string, number>()

        // Pre-sort: items with lower selection_priority come first within
        // their construct group so they survive the per-construct cap.
        // Non-construct items stay in display_order position.
        const constructItems = sectionItems.filter(
          (si) => (!si.items?.purpose || si.items.purpose === 'construct') && si.items?.construct_id
        )
        const nonConstructItems = sectionItems.filter(
          (si) => si.items?.purpose && si.items.purpose !== 'construct'
        )

        // Sort construct items by selection_priority (nulls last)
        constructItems.sort((a, b) => {
          const pa = a.items?.selection_priority ?? 999
          const pb = b.items?.selection_priority ?? 999
          return pa - pb
        })

        // Apply per-construct limit
        const keptConstructItems = constructItems.filter((si) => {
          const key = si.items?.construct_id
          if (!key) return false
          const count = constructItemCounts.get(key) ?? 0
          if (count >= itemsPerConstruct!) return false
          constructItemCounts.set(key, count + 1)
          return true
        })

        // Recombine: non-construct items + kept construct items, re-sorted by display_order
        sectionItems = [...nonConstructItems, ...keptConstructItems]
          .sort((a, b) => a.display_order - b.display_order)
      }
    }

    return {
      id: s.id,
      title: s.title,
      instructions: s.instructions ?? undefined,
      displayOrder: s.display_order,
      responseFormatId: s.response_format_id,
      responseFormatType: formatType,
      responseFormatConfig: formatConfig,
      itemOrdering: s.item_ordering,
      itemsPerPage: s.items_per_page ?? undefined,
      timeLimitSeconds: s.time_limit_seconds ?? undefined,
      allowBackNav: s.allow_back_nav,
      items: sectionItems.map((si) => {
          const itemOptions = (si.items?.item_options ?? [])
            .sort((a, b) => a.display_order - b.display_order)
            .map((o) => ({
              id: o.id,
              label: o.label,
              value: o.value,
              sortOrder: o.display_order,
            }))

          return {
            id: si.items?.id ?? si.item_id,
            stem: si.items?.stem ?? '',
            displayOrder: si.display_order,
            options: itemOptions.length > 0 ? itemOptions : fallbackOptions,
          }
        }),
    }
  })

  // Filter out sections that have no items after factor filtering
  .filter(s => s.items.length > 0)

  // Load existing responses
  const { data: responseRows, error: responseRowsError } = await db
    .from('participant_responses')
    .select('item_id, response_value, response_data')
    .eq('session_id', sessionId)

  if (responseRowsError) {
    logActionError('getSessionState.responses', responseRowsError)
    return { error: 'Unable to load this assessment right now' }
  }

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

  if (error) {
    logActionError('saveResponse.upsert', error)
    return { error: 'Unable to save your response right now' }
  }
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

  if (error) {
    logActionError('updateSessionProgress.update', error)
    return { error: 'Unable to save your progress right now' }
  }
}

// ---------------------------------------------------------------------------
// Lightweight save actions (single DB round-trip via RPC)
// ---------------------------------------------------------------------------

/**
 * Save a response using a single Postgres RPC call that combines
 * ownership validation + upsert. Used by the optimistic save queue
 * in the assessment runner.
 */
export async function saveResponseLite(input: {
  token: string
  sessionId: string
  itemId: string
  sectionId: string
  responseValue: number
  responseData?: Record<string, unknown>
  responseTimeMs?: number
}) {
  const db = createAdminClient()

  const { data, error } = await db.rpc('save_response_for_session', {
    p_access_token: input.token,
    p_session_id: input.sessionId,
    p_item_id: input.itemId,
    p_section_id: input.sectionId,
    p_response_value: input.responseValue,
    p_response_data: input.responseData ?? {},
    p_response_time_ms: input.responseTimeMs ?? null,
  })

  if (error || data === false) {
    logActionError('saveResponseLite.rpc', error ?? 'ownership check failed')
    return { error: 'Unable to save response' }
  }
  return { success: true as const }
}

/**
 * Update session progress using a single Postgres RPC call.
 * Used by the debounced progress updater in the assessment runner.
 */
export async function updateSessionProgressLite(
  token: string,
  sessionId: string,
  update: {
    sectionId: string
    itemIndex: number
  },
) {
  const db = createAdminClient()

  const { data, error } = await db.rpc('update_session_progress_for_session', {
    p_access_token: token,
    p_session_id: sessionId,
    p_current_section_id: update.sectionId,
    p_current_item_index: update.itemIndex,
  })

  if (error || data === false) {
    logActionError('updateSessionProgressLite.rpc', error ?? 'ownership check failed')
    return { error: 'Unable to save progress' }
  }
  return { success: true as const }
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
    .select('campaign_participant_id, assessment_id, campaign_id, status')
    .eq('id', sessionId)
    .eq('campaign_participant_id', access.participantId)
    .single()

  if (fetchErr) {
    logActionError('submitSession.fetch', fetchErr)
    return { error: 'Unable to submit this assessment right now' }
  }

  // Guard: prevent duplicate submission (double-click, network retry)
  if (session.status === 'completed') {
    return { success: true as const }
  }

  const completedAt = new Date().toISOString()

  // Mark session complete — use status guard to prevent race conditions
  const { error: updateErr } = await db
    .from('participant_sessions')
    .update({
      status: 'completed',
      completed_at: completedAt,
    })
    .eq('id', sessionId)
    .eq('campaign_participant_id', access.participantId)
    .eq('status', 'in_progress') // Optimistic lock: only complete if still in_progress

  if (updateErr) {
    logActionError('submitSession.update', updateErr)
    return { error: 'Unable to submit this assessment right now' }
  }

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
            completed_at: completedAt,
          })
          .eq('id', session.campaign_participant_id)
      }

      try {
        await enqueueAssessmentCompletedEvent({
          sessionId,
          campaignId: String(session.campaign_id),
          participantId: String(session.campaign_participant_id),
          assessmentId: String(session.assessment_id),
          allRequiredAssessmentsCompleted: allDone,
          completedAt,
        })
      } catch (eventError) {
        console.error('[integrations] Failed to enqueue assessment.completed event:', eventError)
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
  snapshotId?: string,
): Promise<{ renderedData: unknown[]; status: string; pdfUrl?: string } | null> {
  const result = await validateAccessToken(token)
  if (result.error || !result.data) return null

  const completedSessions = result.data.sessions.filter(
    (s) => s.status === 'completed',
  )
  if (completedSessions.length === 0) return null

  const db = createAdminClient()
  const sessionIds = completedSessions.map((s) => s.id)

  let query = db
    .from('report_snapshots')
    .select(
      'id, rendered_data, status, pdf_url, audience_type, participant_sessions(campaign_participant_id), campaigns(client_id, partner_id)'
    )
    .in('participant_session_id', sessionIds)
    .eq('audience_type', 'participant')
    .eq('status', 'released')
    .order('created_at', { ascending: false })

  if (snapshotId) {
    query = query.eq('id', snapshotId)
  } else {
    query = query.limit(1)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    logActionError('getParticipantReportSnapshot', error)
    return null
  }

  if (!data) return null

  try {
    const campaign = Array.isArray(data.campaigns) ? data.campaigns[0] : data.campaigns
    await logReportViewed({
      snapshotId: String(data.id),
      participantId: result.data.participant.id,
      audienceType: String(data.audience_type),
      partnerId:
        campaign && typeof campaign === 'object' && campaign.partner_id
          ? String(campaign.partner_id)
          : null,
      clientId:
        campaign && typeof campaign === 'object' && campaign.client_id
          ? String(campaign.client_id)
          : result.data.campaign.clientId ?? null,
      metadata: { surface: 'assess' },
    })
  } catch (auditError) {
    logActionError('getParticipantReportSnapshot.audit', auditError)
  }

  // pdf_url now stores a private storage path — resolve a signed URL for download
  const { getSignedReportPdfUrl } = await import('@/app/actions/reports')
  const pdfUrl = await getSignedReportPdfUrl(data.pdf_url)

  return {
    renderedData: data.rendered_data ?? [],
    status: data.status,
    pdfUrl,
  }
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
          p_client_id: campaign.client_id,
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
    .select('id, access_token')
    .single()

  if (insertErr) {
    logActionError('registerViaLink.insert', insertErr)
    return { error: 'Unable to register right now' }
  }

  // Atomically increment the use_count with a conditional update that re-checks
  // capacity and active/expiry constraints. This prevents TOCTOU races where
  // concurrent registrations all pass the pre-check above.
  const { data: incremented, error: rpcErr } = await db.rpc(
    'increment_access_link_usage',
    { p_link_id: link.id },
  )

  if (rpcErr || !incremented) {
    // Link is now full or was deactivated between our checks — roll back.
    await db.from('campaign_participants').delete().eq('id', newParticipant.id)
    return { error: 'This enrollment link has reached its maximum uses' }
  }

  return { accessToken: newParticipant.access_token }
}
