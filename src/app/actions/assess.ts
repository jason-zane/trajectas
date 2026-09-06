'use server'

import { finalizeCompletedSessionProcessing, getExistingCompletedSessionOutcome } from '@/lib/dal/session-processing'
import { createAssessSessionProof } from '@/lib/assess/session-proof'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { likertAnchorOptions } from '@/lib/assess/likert-anchors'
import { logReportViewed } from '@/lib/auth/support-sessions'
import { logActionError } from '@/lib/security/action-errors'
import { getSessionCompleteness } from '@/lib/dal/session-completeness'
import { getOrCreateSectionForms } from '@/lib/dal/session-forms'
import { getCognitiveItemsForDelivery } from '@/lib/dal/cognitive-items'
import {
  getCampaignAccessError,
  getParticipantAccessError,
} from '@/lib/assess/access'
import {
  PARTICIPANT_STARTABLE_STATUSES,
} from '@/lib/assess/participant-status'
import {
  ParticipantRuntimeAccessError,
  requireParticipantRuntimeCampaignAssessmentAccess,
  requireParticipantRuntimeSessionAccess,
} from '@/lib/auth/participant-runtime'
import {
  mapCampaignRow,
  mapCampaignParticipantRow,
  mapCampaignAssessmentRow,
} from '@/lib/supabase/mappers'
import {
  validateAccessTokenInputSchema,
  getAssessmentItemCountInputSchema,
  startSessionInputSchema,
  getSessionStateInputSchema,
  saveResponseInputSchema,
  updateSessionProgressInputSchema,
  saveResponseLiteInputSchema,
  updateSessionProgressLiteInputSchema,
  submitSessionInputSchema,
  startSectionTimingInputSchema,
  finaliseSectionInputSchema,
  getParticipantReportSnapshotInputSchema,
  registerViaLinkInputSchema,
} from '@/lib/validations/assess'
import type { SubmitSessionResult } from '@/lib/assess/session-processing'
import type {
  Campaign,
  CampaignParticipant,
  CampaignAssessment,
  ParticipantSessionProcessingStatus,
  ReportPdfStatus,
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
  processingStatus: ParticipantSessionProcessingStatus
  processingError?: string
  currentSectionId?: string
  currentItemIndex: number
  startedAt?: string
  completedAt?: string
  processedAt?: string
}

export type TokenValidationResult = {
  campaign: Campaign
  participant: CampaignParticipant
  assessments: (CampaignAssessment & AssessmentForRunner)[]
  sessions: SessionForRunner[]
}

/**
 * Server-authoritative timing for a section (LR-2 / #332). getSessionState
 * opens only the explicitly selected section and returns that timing for
 * the section page to reuse. Calls without an openSectionIndex start no
 * clocks. deadlineAt is null for untimed
 * sections (and practice sections, which are never timed regardless of the
 * column) — the client renders no countdown in that case.
 */
export type SectionTimingForRunner = {
  startedAt: string
  deadlineAt: string | null
  serverNow: string
  graceSeconds: number
  expired: boolean
  finalised: boolean
}

export type SectionStartForRunner = { sectionId: string } & (
  | { timing: SectionTimingForRunner }
  | { blocked: 'practice_incomplete' }
)

export type SectionForRunner = {
  id: string
  title: string
  instructions?: string
  displayOrder: number
  responseFormatId: string
  responseFormatType: string
  responseFormatConfig: Record<string, unknown>
  itemOrdering: string
  timeLimitSeconds?: number
  /** 'scored' | 'practice' | 'instructions' (assessment_sections.section_role). */
  sectionRole: string
  /** Enforced server-side too, not just by hiding the Back control — see
   *  save_response_for_session / save_responses_batch_for_session. */
  allowBackNav: boolean
  /** Present once startSectionTiming has been called for this section. */
  timing?: SectionTimingForRunner
  items: ItemForRunner[]
}

/**
 * Cognitive (figural-matrix) stimulus, attached only for items delivered
 * through a `cognitive`-typed response format. `gridSvg` is produced
 * server-side (src/lib/cognitive/render/matrix-svg.ts) from the item's
 * spec, projected through `toRenderSpec()` — the answer key never enters
 * this DTO. See src/lib/dal/cognitive-items.ts.
 */
export type CognitiveStimulus = {
  kind: 'figural_matrix'
  /** Inline SVG markup for the grid's 8 real cells. */
  gridSvg: string
  /** Honest accessibility identification, NOT a cell-by-cell description
   *  (doc 03-logical-reasoning-design.md §7.4 — a verbal description would
   *  convert an inductive visual-relational task into a different construct). */
  ariaLabel: string
}

export type ItemOptionForRunner = {
  id: string
  label: string
  value: number
  sortOrder: number
  /** Present only for cognitive items — server-rendered SVG for this option's tile. */
  optionSvg?: string
}

export type ItemForRunner = {
  id: string
  stem: string
  displayOrder: number
  options: ItemOptionForRunner[]
  /** Present only for cognitive (figural-matrix) items. */
  stimulus?: CognitiveStimulus
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
  stem_observer: string | null
  construct_id: string | null
  purpose: string | null
  difficulty: 'easy' | 'medium' | 'hard' | null
  reverse_scored: boolean | null
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
  time_limit_seconds: number | null
  section_role: string
  allow_back_nav: boolean
  response_formats: AssessmentSectionResponseFormatRow
  assessment_section_items: AssessmentSectionItemRow[] | null
}



async function markCampaignParticipantStarted(
  db: ReturnType<typeof createAdminClient>,
  campaignParticipantId: string,
  startedAt: string,
) {
  const { error } = await db
    .from('campaign_participants')
    .update({
      status: 'in_progress',
      started_at: startedAt,
    })
    .eq('id', campaignParticipantId)
    .in('status', PARTICIPANT_STARTABLE_STATUSES)

  if (error) {
    logActionError('startSession.participantStatus', error)
  }
}

// ---------------------------------------------------------------------------
// Token validation
// ---------------------------------------------------------------------------

async function validateAccessTokenImpl(
  token: string,
): Promise<{ data?: TokenValidationResult; error?: string }> {
  const parsed = validateAccessTokenInputSchema.safeParse({ token })
  if (!parsed.success) {
    return { error: 'Invalid or expired access link' }
  }

  const db = createAdminClient()

  // Find participant by token
  const { data: participantRow, error: participantErr } = await db
    .from('campaign_participants')
    .select('*')
    .eq('access_token', token)
    .is('deleted_at', null)
    .single()

  if (participantErr && participantErr.code !== 'PGRST116') {
    logActionError('validateAccessToken.participant', participantErr)
    // Let the assessment error boundary offer Retry. Returning an invalid-
    // link result would redirect every page to "expired" for a network fault.
    throw new Error('Unable to load this assessment right now')
  }
  if (!participantRow) {
    return { error: 'Invalid or expired access link' }
  }

  const participant = mapCampaignParticipantRow(participantRow)

  const [
    { data: campaignRow, error: campaignErr },
    { data: sessionRows, error: sessionRowsError },
    { data: caRows, error: campaignAssessmentsError },
  ] =
    await Promise.all([
      db
        .from('campaigns')
        .select('*')
        .eq('id', participant.campaignId)
        .is('deleted_at', null)
        .single(),
      db
        .from('participant_sessions')
        .select('*')
        .eq('campaign_participant_id', participant.id),
      db
        .from('campaign_assessments')
        .select('*, assessments(id, title, description, assessment_sections(count))')
        .eq('campaign_id', participant.campaignId)
        .is('deleted_at', null)
        .order('display_order', { ascending: true }),
    ])

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

  if (sessionRowsError) {
    logActionError('validateAccessToken.sessions', sessionRowsError)
    return { error: 'Unable to load this assessment right now' }
  }

  const sessions: SessionForRunner[] = (sessionRows ?? []).map((s) => ({
    id: s.id,
    assessmentId: s.assessment_id,
    status: s.status,
    processingStatus: (s.processing_status ?? 'idle') as ParticipantSessionProcessingStatus,
    processingError: s.processing_error ?? undefined,
    currentSectionId: s.current_section_id ?? undefined,
    currentItemIndex: s.current_item_index ?? 0,
    startedAt: s.started_at ?? undefined,
    completedAt: s.completed_at ?? undefined,
    processedAt: s.processed_at ?? undefined,
  }))

  return {
    data: { campaign, participant, assessments, sessions },
  }
}

export const validateAccessToken = cache(validateAccessTokenImpl)

/**
 * Returns the total number of items across all sections for the given assessment IDs.
 * Used to compute estimated completion time on the welcome page.
 */
export async function getAssessmentItemCount(assessmentIds: string[]): Promise<number> {
  const parsed = getAssessmentItemCountInputSchema.safeParse({ assessmentIds })
  if (!parsed.success) return 0

  if (assessmentIds.length === 0) return 0
  const db = createAdminClient()
  const { data: sections } = await db
    .from('assessment_sections')
    .select('id')
    .in('assessment_id', assessmentIds)
  const sectionIds = (sections ?? []).map((s) => s.id as string)
  if (sectionIds.length === 0) return 0
  const { count } = await db
    .from('assessment_section_items')
    .select('*', { count: 'exact', head: true })
    .in('section_id', sectionIds)
  return count ?? 0
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
  const parsed = startSessionInputSchema.safeParse({ token, campaignParticipantId, assessmentId, campaignId })
  if (!parsed.success) {
    return { error: 'Invalid input' }
  }

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
  const startedAt = new Date().toISOString()

  // Check for existing session
  const { data: existing } = await db
    .from('participant_sessions')
    .select('id')
    .eq('campaign_participant_id', campaignParticipantId)
    .eq('assessment_id', assessmentId)
    .single()

  if (existing) {
    await markCampaignParticipantStarted(db, campaignParticipantId, startedAt)
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
      processing_status: 'idle',
      started_at: startedAt,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      const { data: winner } = await db.from('participant_sessions').select('id')
        .eq('campaign_participant_id', campaignParticipantId).eq('assessment_id', assessmentId).single()
      if (winner) return { id: winner.id }
    }
    logActionError('startSession.insert', error)
    return { error: 'Unable to start this assessment right now' }
  }

  // Update participant status to in_progress
  await markCampaignParticipantStarted(db, campaignParticipantId, startedAt)

  return { id: session.id }
}

export async function getSessionState(token: string, sessionId: string, openSectionIndex?: number) {
  const parsed = getSessionStateInputSchema.safeParse({ token, sessionId })
  if (!parsed.success) {
    return { error: 'Invalid input' }
  }

  try {
    await requireParticipantRuntimeSessionAccess(token, sessionId)
  } catch (error) {
    if (error instanceof ParticipantRuntimeAccessError) {
      return { error: error.message }
    }
    throw error
  }

  if (openSectionIndex !== undefined && (!Number.isInteger(openSectionIndex) || openSectionIndex < 0)) {
    return { error: 'Invalid section' }
  }

  const db = createAdminClient()

  const { data: session, error } = await db
    .from('participant_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (error || !session) return { error: 'Session not found' }

  // Fan out all queries that depend only on session.assessment_id / session.campaign_id
  // / sessionId in parallel. Previously participant_responses ran serially after
  // the construct-filter work despite being fully independent.
  //
  // The campaign factor filter + selectItemsByDifficulty + applyItemOrdering
  // pipeline that used to run inline here (LR-3 / #333) now lives in
  // src/lib/dal/session-forms.ts, invoked below via getOrCreateSectionForms.
  // It freezes the delivered item set (id, order, item_version, content_hash)
  // per (session, section) the first time it is computed, and every
  // subsequent read — this call included — returns that frozen form instead
  // of recomputing it. See that module and
  // supabase/migrations/20260813103000_frozen_session_forms.sql for why.
  // Freeze before fetching content: an authoring edit that wins the freeze
  // race must not leave this request rendering an older in-memory item row.
  const formsResult = await getOrCreateSectionForms(db, {
    sessionId,
    assessmentId: session.assessment_id,
    campaignId: session.campaign_id ?? null,
  })
  if ('error' in formsResult) return { error: formsResult.error }
  const [sectionResult, responsesResult, participantRaterResult] =
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
            items(id, stem, stem_observer, construct_id, purpose, difficulty, reverse_scored, item_options(id, label, value, display_order))
          )
        `)
        .eq('assessment_id', session.assessment_id)
        .order('display_order', { ascending: true }),
      db
        .from('participant_responses')
        .select('item_id, response_value, response_data, client_revision')
        .eq('session_id', sessionId),
      // Is this a 360 rater (observer) session? If the owning participant links
      // to a campaign_rater, serve the observer-worded stems.
      session.campaign_participant_id
        ? db
            .from('campaign_participants')
            .select('campaign_rater_id')
            .eq('id', session.campaign_participant_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

  const { data: sectionRows, error: sectionRowsError } = sectionResult
  if (sectionRowsError) {
    logActionError('getSessionState.sections', sectionRowsError)
    return { error: 'Unable to load this assessment right now' }
  }

  const deliverableSections = ((sectionRows ?? []) as AssessmentSectionRow[])
    .filter(section => (formsResult.get(section.id)?.entries.length ?? 0) > 0)
  let sectionStart: SectionStartForRunner | undefined
  let timingReceivedAt = 0
  if (session.status === 'in_progress' && openSectionIndex !== undefined && deliverableSections.length > 0) {
    const selectedSection = deliverableSections[Math.min(openSectionIndex, deliverableSections.length - 1)]
    const opened = await startSectionTiming(token, sessionId, selectedSection.id)
    if ('error' in opened) return { error: opened.error }
    sectionStart = 'blocked' in opened
      ? { sectionId: selectedSection.id, blocked: opened.blocked }
      : { sectionId: selectedSection.id, timing: opened.data }
    timingReceivedAt = performance.now()
  }
  const { data: openedStates, error: statesError } = await db.from('participant_section_states')
    .select('section_id').eq('session_id', sessionId)
  if (statesError) return { error: 'Unable to load section timing right now.' }
  const openedSectionIds = new Set((openedStates ?? []).map(row => row.section_id))

  // 360 rater sessions render the observer-worded stem; everyone else (subject /
  // self participants) gets the first-person stem.
  const isObserverSession = Boolean(
    (participantRaterResult.data as { campaign_rater_id?: string | null } | null)
      ?.campaign_rater_id,
  )

  // Populated while building `sections` below, for cognitive (figural-matrix)
  // items only — see the getCognitiveItemsForDelivery pass after the map.
  const cognitiveItemIds: string[] = []

  const sections: SectionForRunner[] = ((sectionRows ?? []) as AssessmentSectionRow[]).map((s) => {
    const formatConfig = s.response_formats?.config ?? {}
    const formatType = s.response_formats?.type ?? 'likert'
    const isCognitive = formatType === 'cognitive'
    const contentVisible = !s.time_limit_seconds || s.section_role === 'practice' || openedSectionIds.has(s.id)

    // Derive fallback options from response format anchors when item_options is empty.
    // This handles AI-generated items that have stems but no per-item options.
    function deriveOptionsFromFormat() {
      if (formatType !== 'likert') return []
      return likertAnchorOptions(formatConfig.anchors).map((o) => ({
        id: `rf-${o.value}`,
        label: o.label,
        value: o.value,
        sortOrder: o.value,
      }))
    }

    const fallbackOptions = deriveOptionsFromFormat()

    // Delivery order comes from the frozen form, not a live recomputation —
    // look each entry's item id up against this section's (unfiltered) joined
    // rows for its stem/options. An entry whose item no longer resolves here
    // (e.g. soft-deleted since the freeze) is skipped defensively rather than
    // rendering a broken item; per-content drift detection is the future
    // scorer's job (it has itemVersion/contentHash to compare against), not
    // delivery's.
    const rawByItemId = new Map<string, AssessmentSectionItemRow>()
    for (const si of s.assessment_section_items ?? []) {
      rawByItemId.set(si.item_id, si)
    }
    const form = formsResult.get(s.id)
    const sectionItems = (form?.entries ?? [])
      .map((entry) => rawByItemId.get(entry.itemId))
      .filter((si): si is AssessmentSectionItemRow => Boolean(si))

    return {
      id: s.id,
      title: s.title,
      instructions: s.instructions ?? undefined,
      displayOrder: s.display_order,
      responseFormatId: s.response_format_id,
      responseFormatType: formatType,
      responseFormatConfig: formatConfig,
      itemOrdering: s.item_ordering,
      timeLimitSeconds: s.time_limit_seconds ?? undefined,
      sectionRole: s.section_role ?? 'scored',
      allowBackNav: s.allow_back_nav ?? true,
      items: sectionItems.map((si) => {
          const itemOptions = (si.items?.item_options ?? [])
            .sort((a, b) => a.display_order - b.display_order)
            .map((o) => ({
              id: o.id,
              label: o.label,
              value: o.value,
              sortOrder: o.display_order,
            }))

          const selfStem = si.items?.stem ?? ''
          const itemId = si.items?.id ?? si.item_id
          if (isCognitive && contentVisible) cognitiveItemIds.push(itemId)
          return {
            id: itemId,
            // Observer (rater) sessions show the third-person variant when present.
            stem: !contentVisible ? '' : isObserverSession
              ? (si.items?.stem_observer ?? selfStem)
              : selfStem,
            displayOrder: si.display_order,
            options: !contentVisible ? [] : itemOptions.length > 0 ? itemOptions : fallbackOptions,
          }
        }),
    }
  })

  // Filter out sections with no frozen entries (no items after factor
  // filtering, or an instructions-only section with nothing to deliver).
  .filter(s => s.items.length > 0)

  // Attach cognitive (figural-matrix) stimulus/option SVGs. Done as a
  // second pass, after `sections` is built, because the item ids to render
  // aren't known until factor filtering + item-selection + item-ordering
  // (all synchronous, above) have run, and getCognitiveItemsForDelivery is
  // the only DAL function allowed to touch cognitive_item_specs /
  // cognitive_option_specs (see tests/architecture/answer-key-isolation.test.ts
  // and src/lib/dal/cognitive-items.ts). No-op (and no extra query) for
  // every non-cognitive assessment.
  if (cognitiveItemIds.length > 0) {
    const cognitiveRenders = await getCognitiveItemsForDelivery(db, cognitiveItemIds)
    for (const section of sections) {
      if (section.responseFormatType !== 'cognitive') continue
      for (const item of section.items) {
        const render = cognitiveRenders.get(item.id)
        if (!render) continue // spec failed to parse — falls back to the plain stem/options below
        item.stimulus = { kind: 'figural_matrix', gridSvg: render.gridSvg, ariaLabel: render.ariaLabel }
        item.options = item.options.map((o) => ({
          ...o,
          optionSvg: render.optionSvgByOptionId.get(o.id),
        }))
      }
    }
  }

  const { data: responseRows, error: responseRowsError } = responsesResult
  if (responseRowsError) {
    logActionError('getSessionState.responses', responseRowsError)
    return { error: 'Unable to load this assessment right now' }
  }

  const responses: Record<string, { value: number; data: Record<string, unknown>; revision: number }> = {}
  for (const r of responseRows ?? []) {
    responses[r.item_id] = {
      value: Number(r.response_value),
      data: r.response_data ?? {},
      revision: Number(r.client_revision ?? 0),
    }
  }

  if (sectionStart && 'timing' in sectionStart) {
    // The countdown estimates clock skew from serverNow at mount. Account
    // for content loading after receipt of the timing RPC, without another
    // auth/RPC round trip or moving the original database-issued deadline.
    const timing = sectionStart.timing
    const nowMs = Date.parse(timing.serverNow) + Math.max(0, performance.now() - timingReceivedAt)
    sectionStart = {
      ...sectionStart,
      timing: {
        ...timing,
        serverNow: new Date(nowMs).toISOString(),
        expired: timing.expired || (timing.deadlineAt !== null && Date.parse(timing.deadlineAt) <= nowMs),
      },
    }
  }

  return {
    data: {
      sessionId: session.id,
      sectionStart,
      sessionProof: createAssessSessionProof(token, sessionId),
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
// Server-authoritative section timing (LR-2 / #332)
// ---------------------------------------------------------------------------

/**
 * Starts (or resumes) the server-side clock for one section. getSessionState
 * invokes this only when a caller explicitly supplies the section index it
 * is opening; read-only state/review calls do not start any clocks.
 *
 * Idempotent: the underlying RPC INSERTs the (session, section) row once
 * (ON CONFLICT DO NOTHING) and always returns the ORIGINAL startedAt/
 * deadlineAt on every subsequent call — a refresh, a second tab, or a retry
 * after a network blip all resume against the same deadline, never restart
 * or extend it.
 */
export async function startSectionTiming(
  token: string,
  sessionId: string,
  sectionId: string,
): Promise<
  | { data: SectionTimingForRunner }
  | { blocked: 'practice_incomplete' }
  | { error: string }
> {
  const parsed = startSectionTimingInputSchema.safeParse({ token, sessionId, sectionId })
  if (!parsed.success) {
    return { error: 'Invalid input' }
  }

  try {
    await requireParticipantRuntimeSessionAccess(token, sessionId)
  } catch (error) {
    if (error instanceof ParticipantRuntimeAccessError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { data, error } = await db.rpc('start_section_for_session', {
    p_access_token: token,
    p_session_id: sessionId,
    p_section_id: sectionId,
  })

  if (error) {
    logActionError('startSectionTiming.rpc', error)
    return { error: 'Unable to start this section right now' }
  }
  if (!data) {
    return { error: 'This section is not available right now' }
  }

  // LR-6 / #336 practice-completion gate — start_section_for_session
  // returns this distinctly-shaped payload (never NULL) instead of the
  // normal timing row when the section is 'scored' and a 'practice'-role
  // section in this assessment still has unanswered items for this
  // session. See supabase/migrations/20260814100000_lr6_practice_completion
  // _gate.sql. The caller (the section page) must route the participant
  // back to practice, not render an untimed scored section.
  if ((data as { blocked?: string }).blocked === 'practice_incomplete') {
    return { blocked: 'practice_incomplete' }
  }

  const row = data as SectionTimingForRunner
  return {
    data: {
      startedAt: row.startedAt,
      deadlineAt: row.deadlineAt,
      serverNow: row.serverNow,
      graceSeconds: row.graceSeconds,
      expired: row.expired,
      finalised: row.finalised,
    },
  }
}

/**
 * Ends a section: the participant finished it normally ('participant'), or
 * the client-side SectionTimer fired ('client_timer'). The RPC is the actual
 * gate — a 'client_timer' claim is refused unless the server-stamped
 * deadline has genuinely passed, so a tampered client cannot end a timed
 * section early. 'participant' is always honoured, timed or not.
 */
export async function finaliseSection(
  token: string,
  sessionId: string,
  sectionId: string,
  reason: 'participant' | 'client_timer',
): Promise<{ success: true; unansweredCount: number } | { error: string }> {
  const parsed = finaliseSectionInputSchema.safeParse({ token, sessionId, sectionId, reason })
  if (!parsed.success) {
    return { error: 'Invalid input' }
  }

  try {
    await requireParticipantRuntimeSessionAccess(token, sessionId)
  } catch (error) {
    if (error instanceof ParticipantRuntimeAccessError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { data, error } = await db.rpc('finalise_section_for_session', {
    p_access_token: token,
    p_session_id: sessionId,
    p_section_id: sectionId,
    p_reason: reason,
  })

  if (error) {
    logActionError('finaliseSection.rpc', error)
    return { error: 'Unable to finalise this section right now' }
  }
  if (!data) {
    // Either the token/section didn't validate, or (reason='client_timer')
    // the deadline genuinely hasn't passed yet.
    return { error: 'This section cannot be finalised yet' }
  }

  const row = data as { finalised: boolean; unansweredCount: number }
  return { success: true, unansweredCount: row.unansweredCount }
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
  const parsed = saveResponseInputSchema.safeParse({ token, sessionId, itemId, sectionId, responseValue, responseData, responseTimeMs })
  if (!parsed.success) {
    return { error: 'Invalid input' }
  }

  try {
    await requireParticipantRuntimeSessionAccess(token, sessionId)
  } catch (error) {
    if (error instanceof ParticipantRuntimeAccessError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()

  const { data: saved, error } = await db.rpc('save_responses_batch_for_session', {
    p_access_token: token,
    p_session_id: sessionId,
    p_saves: [{ itemId, responseValue, responseData: responseData ?? {}, responseTimeMs }],
  })

  if (error) {
    logActionError('saveResponse.upsert', error)
    return { error: 'Unable to save your response right now' }
  }
  if (!saved || typeof saved !== 'object' || !Array.isArray(saved.acked) || !saved.acked.includes(itemId)) {
    return { error: 'This response cannot be saved.' }
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
  const parsed = updateSessionProgressInputSchema.safeParse({ token, sessionId, update })
  if (!parsed.success) {
    return { error: 'Invalid input' }
  }

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
  const parsed = saveResponseLiteInputSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Invalid input' }
  }

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
  const parsed = updateSessionProgressLiteInputSchema.safeParse({ token, sessionId, update })
  if (!parsed.success) {
    return { error: 'Invalid input' }
  }

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

export async function submitSession(
  token: string,
  sessionId: string,
): Promise<SubmitSessionResult> {
  const parsed = submitSessionInputSchema.safeParse({ token, sessionId })
  if (!parsed.success) {
    return { ok: false, error: 'invalid_access', message: 'Invalid input' }
  }

  let access: Awaited<ReturnType<typeof requireParticipantRuntimeSessionAccess>>
  try {
    access = await requireParticipantRuntimeSessionAccess(token, sessionId)
  } catch (error) {
    if (error instanceof ParticipantRuntimeAccessError) {
      return {
        ok: false,
        error: 'invalid_access',
        message: error.message,
      }
    }
    throw error
  }

  const db = createAdminClient()

  const { data: session, error: fetchErr } = await db
    .from('participant_sessions')
    .select(
      'campaign_participant_id, assessment_id, campaign_id, status, completed_at, processing_status, processing_error',
    )
    .eq('id', sessionId)
    .eq('campaign_participant_id', access.participantId)
    .single()

  if (fetchErr) {
    logActionError('submitSession.fetch', fetchErr)
    return {
      ok: false,
      error: 'submit_failed',
      message: 'Unable to submit this assessment right now',
    }
  }

  // Hard completeness gate: a session still in progress can only be submitted
  // once every item DELIVERED to it has a saved response (the DAL mirrors the
  // runner's factor-selection filtering). Already-completed sessions skip
  // this — their re-submits only retry scoring/report work.
  if (session.status === 'in_progress') {
    const completeness = await getSessionCompleteness(db, {
      sessionId,
      assessmentId: session.assessment_id,
      campaignId: session.campaign_id ?? null,
    })
    if ('error' in completeness) {
      return { ok: false, error: 'submit_failed', message: completeness.error }
    }
    if (completeness.expected > 0 && completeness.answered < completeness.expected) {
      const missing = completeness.expected - completeness.answered
      return {
        ok: false,
        error: 'incomplete_submission',
        message:
          missing === 1
            ? '1 question is still unanswered. Please answer every question before submitting.'
            : `${missing} of ${completeness.expected} questions are still unanswered. Please answer every question before submitting.`,
      }
    }
  }

  // 360 raters take the observer survey but are never individually scored or
  // reported (their responses feed the subject's aggregate snapshot). Complete
  // the session and stop — do not trigger report generation.
  const { data: raterParticipant } = await db
    .from('campaign_participants')
    .select('campaign_rater_id')
    .eq('id', access.participantId)
    .maybeSingle()
  if (raterParticipant?.campaign_rater_id) {
    if (session.status !== 'completed') {
      const nowTs = new Date().toISOString()
      await db
        .from('participant_sessions')
        .update({
          status: 'completed',
          completed_at: nowTs,
          processing_status: 'ready',
          processing_error: null,
          processed_at: nowTs,
        })
        .eq('id', sessionId)
        .eq('campaign_participant_id', access.participantId)
      // Mark the rater's participant row completed so the Raters tab reflects it.
      await db
        .from('campaign_participants')
        .update({ status: 'completed', completed_at: nowTs })
        .eq('id', access.participantId)
    }
    return {
      ok: true,
      outcome: 'completed_no_report',
      sessionId,
      processingStatus: 'ready',
    }
  }

  if (
    session.status === 'completed' &&
    (session.processing_status === 'ready' ||
      session.processing_status === 'reporting')
  ) {
    return getExistingCompletedSessionOutcome(sessionId)
  }

  // Guard: duplicate submission / retry should re-run processing if the session
  // is complete but not yet ready.
  if (session.status === 'completed') {
    return finalizeCompletedSessionProcessing({
      sessionId,
      campaignId: session.campaign_id ?? null,
      campaignParticipantId: session.campaign_participant_id ?? null,
      assessmentId: session.assessment_id ?? null,
      completedAt: session.completed_at ?? new Date().toISOString(),
      emitAssessmentCompletedEvent: false,
    })
  }

  const completedAt = new Date().toISOString()

  // Mark session complete — use status guard to prevent race conditions
  const { data: completedRows, error: updateErr } = await db
    .from('participant_sessions')
    .update({
      status: 'completed',
      completed_at: completedAt,
      processing_status: 'scoring',
      processing_error: null,
      processed_at: null,
    })
    .eq('id', sessionId)
    .eq('campaign_participant_id', access.participantId)
    .eq('status', 'in_progress')
    .select('id')

  if (updateErr) {
    logActionError('submitSession.update', updateErr)
    return {
      ok: false,
      error: 'submit_failed',
      message: 'Unable to submit this assessment right now',
    }
  }

  if (!completedRows?.length) return getExistingCompletedSessionOutcome(sessionId)

  return finalizeCompletedSessionProcessing({
    sessionId,
    campaignId: session.campaign_id ?? null,
    campaignParticipantId: session.campaign_participant_id ?? null,
    assessmentId: session.assessment_id ?? null,
    completedAt,
    emitAssessmentCompletedEvent: true,
  })
}

/**
 * Get the participant-facing report snapshot for completed sessions.
 * Called from the participant runtime — no admin auth required,
 * validated via access token ownership of the session.
 */
export async function getParticipantReportSnapshot(
  token: string,
  snapshotId?: string,
): Promise<{
  id: string
  renderedData: unknown[]
  status: string
  pdfUrl?: string
  pdfStatus?: ReportPdfStatus
  errorMessage?: string
} | null> {
  const parsed = getParticipantReportSnapshotInputSchema.safeParse({ token, snapshotId })
  if (!parsed.success) return null

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
      'id, rendered_data, status, pdf_url, pdf_status, error_message, participant_sessions(campaign_participant_id), campaigns(client_id, partner_id)'
    )
    .in('participant_session_id', sessionIds)
    .or('audience_type.is.null,audience_type.eq.participant')
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
  if (data.status !== 'released') {
    return { id: String(data.id), renderedData: [], status: data.status }
  }

  try {
    const campaign = Array.isArray(data.campaigns) ? data.campaigns[0] : data.campaigns
    if (data.status === 'released') {
      await logReportViewed({
        snapshotId: String(data.id),
        participantId: result.data.participant.id,
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
    }
  } catch (auditError) {
    logActionError('getParticipantReportSnapshot.audit', auditError)
  }

  // pdf_url now stores a private storage path — resolve a signed URL for download
  const { getSignedReportPdfUrl } = await import('@/lib/reports/pdf-access')
  const pdfUrl = await getSignedReportPdfUrl(data.pdf_url)

  return {
    id: String(data.id),
    renderedData: data.rendered_data ?? [],
    status: data.status,
    pdfUrl,
    pdfStatus: data.pdf_status ?? undefined,
    errorMessage: data.error_message ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// Open enrollment (join via access link)
// ---------------------------------------------------------------------------

export async function registerViaLink(
  linkToken: string,
  { email, firstName, lastName, jobTitle, company, marketingConsent }: {
    email: string
    firstName: string
    lastName: string
    jobTitle?: string
    company?: string
    marketingConsent?: boolean
  },
) {
  const parsed = registerViaLinkInputSchema.safeParse({ linkToken, email, firstName, lastName, jobTitle, company, marketingConsent })
  if (!parsed.success) {
    return { error: 'Invalid input' }
  }

  const db = createAdminClient()
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedFirstName = firstName.trim()
  const normalizedLastName = lastName.trim()
  const normalizedJobTitle = jobTitle?.trim() || null
  const normalizedCompany = company?.trim() || null

  if (!normalizedEmail) {
    return { error: 'Email is required' }
  }

  if (!normalizedFirstName || !normalizedLastName) {
    return { error: 'First name and last name are required' }
  }

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

  // Enforce the campaign's schedule window — an open link must not accept
  // enrolments before opens_at or after closes_at.
  const scheduleError = getCampaignAccessError({
    status: campaign.status,
    opensAt: campaign.opens_at,
    closesAt: campaign.closes_at,
  })
  if (scheduleError) {
    return { error: 'This campaign is not currently accepting registrations' }
  }

  // Every link-based registration creates a fresh participant record.
  // Participants who need to resume use their unique access-token URL.

  // Quota check: only applies when campaign belongs to a client
  if (campaign.client_id) {
    const { data: campaignAssessments } = await db
      .from('campaign_assessments')
      .select('assessment_id')
      .eq('campaign_id', link.campaign_id)
      .is('deleted_at', null)

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
      email: normalizedEmail,
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
      job_title: normalizedJobTitle,
      company: normalizedCompany,
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
