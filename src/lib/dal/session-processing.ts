import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { logActionError } from '@/lib/security/action-errors'
import { requireAppUrl } from '@/lib/hosts'
import { reportError } from '@/lib/observability/report-error'
import { scoreSession } from '@/lib/scoring/dispatch'
import { PARTICIPANT_COMPLETABLE_STATUSES } from '@/lib/assess/participant-status'
import { shouldGenerateIndividualReports, type CampaignConfidentialityMode } from '@/lib/reports/confidentiality'
import { enqueueAssessmentCompletedEvent } from '@/lib/integrations/events'
import { triggerReportGenerationInputSchema } from '@/lib/validations/assess'
import type { SubmitSessionResult } from '@/lib/assess/session-processing'
import type { ParticipantSessionProcessingStatus, ReportSnapshotStatus } from '@/types/database'

// Shared by the authorized participant submit action and the authenticated
// recovery cron. These functions are server-only, never public Server Actions.
type SnapshotStatusRow = {
  id: string
  template_id: string
  status: ReportSnapshotStatus
}

const ASSESSMENT_PROCESSING_ERROR =
  'We saved your answers, but couldn’t finish processing your assessment. Please try again in a moment.'
const REPORT_PROCESSING_ERROR =
  'We saved your answers and calculated your scores, but couldn’t start preparing your report. Please try again in a moment.'

async function ensureReportSnapshotsForSession(input: {
  sessionId: string
  campaignId: string
}): Promise<
  | {
      hasParticipantReport: boolean
      participantSnapshotStatus: ReportSnapshotStatus | null
      hasPendingSnapshotWork: boolean
    }
  | { error: string }
> {
  const db = createAdminClient()

  // Aggregate-only campaigns never generate individual report snapshots:
  // the participant promise is group-level reporting only, so the artefacts
  // that could leak individual results are never created. See
  // src/lib/reports/confidentiality.ts for the policy.
  const { data: campaignModeRow, error: campaignModeError } = await db
    .from('campaigns')
    .select('confidentiality_mode')
    .eq('id', input.campaignId)
    .maybeSingle()

  if (campaignModeError) {
    logActionError('submitSession.campaignConfidentiality', campaignModeError)
    return { error: 'Unable to load this campaign report configuration' }
  }
  const confidentialityMode = (campaignModeRow?.confidentiality_mode ??
    'standard') as CampaignConfidentialityMode
  if (!shouldGenerateIndividualReports(confidentialityMode)) {
    return {
      hasParticipantReport: false,
      participantSnapshotStatus: null,
      hasPendingSnapshotWork: false,
    }
  }

  // Resolve which templates fire for this session.
  // Layer 1: campaign-level extras  +  Layer 2: assessment-level defaults  (union)
  // If both empty, Layer 3: platform-wide `report_templates.is_default = true` rows.
  const [campaignTemplatesResult, sessionRowResult] = await Promise.all([
    db.from('campaign_report_templates').select('template_id').eq('campaign_id', input.campaignId),
    db
      .from('participant_sessions')
      .select('assessment_id')
      .eq('id', input.sessionId)
      .maybeSingle(),
  ])

  if (campaignTemplatesResult.error) {
    logActionError('submitSession.reportConfig', campaignTemplatesResult.error)
    return { error: 'Unable to load this campaign report configuration' }
  }
  if (sessionRowResult.error) {
    logActionError('submitSession.assessmentLookup', sessionRowResult.error)
    return { error: 'Unable to load this campaign report configuration' }
  }

  const desiredIds = new Set<string>()
  for (const row of campaignTemplatesResult.data ?? []) {
    const id = String((row as { template_id?: string | null }).template_id ?? '')
    if (id) desiredIds.add(id)
  }

  const assessmentId =
    (sessionRowResult.data as { assessment_id?: string | null } | null)?.assessment_id ?? null
  if (assessmentId) {
    const { data: assessmentDefaults, error: assessmentDefaultsError } = await db
      .from('assessment_report_templates')
      .select('template_id')
      .eq('assessment_id', assessmentId)
      .eq('is_default', true)
      .order('sort_order', { ascending: true })

    if (assessmentDefaultsError) {
      logActionError('submitSession.assessmentDefaults', assessmentDefaultsError)
      return { error: 'Unable to load this campaign report configuration' }
    }

    for (const row of assessmentDefaults ?? []) {
      const id = String((row as { template_id?: string | null }).template_id ?? '')
      if (id) desiredIds.add(id)
    }
  }

  // Platform fallback (Layer 3): only when nothing more specific was bound.
  if (desiredIds.size === 0) {
    const { data: platformDefaults, error: platformDefaultsError } = await db
      .from('report_templates')
      .select('id')
      .eq('is_default', true)
      .eq('is_active', true)
      .is('deleted_at', null)

    if (platformDefaultsError) {
      logActionError('submitSession.platformDefaults', platformDefaultsError)
      return { error: 'Unable to load this campaign report configuration' }
    }
    for (const row of platformDefaults ?? []) {
      const id = String((row as { id?: string | null }).id ?? '')
      if (id) desiredIds.add(id)
    }
  }

  // Final pass: keep only active, non-deleted templates so a stale link doesn't
  // produce an unrunnable snapshot.
  let desiredTemplateIds: string[] = []
  if (desiredIds.size > 0) {
    const { data: liveTemplates, error: liveTemplatesError } = await db
      .from('report_templates')
      .select('id')
      .in('id', Array.from(desiredIds))
      .eq('is_active', true)
      .is('deleted_at', null)

    if (liveTemplatesError) {
      logActionError('submitSession.templateActivityCheck', liveTemplatesError)
      return { error: 'Unable to load this campaign report configuration' }
    }
    desiredTemplateIds = (liveTemplates ?? [])
      .map((r) => String((r as { id?: string }).id ?? ''))
      .filter((id) => id.length > 0)
  }

  if (desiredTemplateIds.length === 0) {
    return {
      hasParticipantReport: false,
      participantSnapshotStatus: null,
      hasPendingSnapshotWork: false,
    }
  }

  const { data: existingRows, error: existingError } = await db
    .from('report_snapshots')
    .select('id, template_id, status')
    .eq('participant_session_id', input.sessionId)

  if (existingError) {
    logActionError('submitSession.reportSnapshots.fetch', existingError)
    return { error: 'Unable to inspect the current report state' }
  }

  const existingByTemplate = new Map<string, SnapshotStatusRow>()
  for (const row of (existingRows ?? []) as SnapshotStatusRow[]) {
    existingByTemplate.set(row.template_id, row)
  }

  let hasPendingSnapshotWork = false
  let firstSnapshotStatus: ReportSnapshotStatus | null = null

  for (const templateId of desiredTemplateIds) {
    const existing = existingByTemplate.get(templateId)

    if (!existing) {
      const { error: insertError } = await db
        .from('report_snapshots')
        .upsert({
          campaign_id: input.campaignId,
          participant_session_id: input.sessionId,
          template_id: templateId,
          narrative_mode: 'derived',
          status: 'pending',
        }, { onConflict: 'participant_session_id,template_id', ignoreDuplicates: true })

      if (insertError) {
        logActionError('submitSession.reportSnapshots.insert', insertError)
        return { error: 'Unable to prepare this report right now' }
      }

      hasPendingSnapshotWork = true
      if (!firstSnapshotStatus) firstSnapshotStatus = 'pending'
    } else if (existing.status === 'failed') {
      const { error: resetError } = await db
        .from('report_snapshots')
        .update({
          status: 'pending',
          error_message: null,
          generated_at: null,
          released_at: null,
          rendered_data: null,
          pdf_url: null,
          pdf_status: null,
          pdf_error_message: null,
        })
        .eq('id', existing.id)

      if (resetError) {
        logActionError('submitSession.reportSnapshots.reset', resetError)
        return { error: 'Unable to retry this report right now' }
      }

      existing.status = 'pending'
      hasPendingSnapshotWork = true
      if (!firstSnapshotStatus) firstSnapshotStatus = 'pending'
    } else if (existing.status === 'pending') {
      hasPendingSnapshotWork = true
      if (!firstSnapshotStatus) firstSnapshotStatus = 'pending'
    } else {
      if (!firstSnapshotStatus) firstSnapshotStatus = existing.status
    }
  }

  return {
    hasParticipantReport: desiredTemplateIds.length > 0,
    participantSnapshotStatus: firstSnapshotStatus,
    hasPendingSnapshotWork,
  }
}

async function markParticipantSessionProcessing(
  sessionId: string,
  update: {
    status: ParticipantSessionProcessingStatus
    error?: string | null
    processedAt?: string | null
  },
): Promise<boolean> {
  const db = createAdminClient()
  const { error } = await db
    .from('participant_sessions')
    .update({
      processing_status: update.status,
      processing_claimed_at: ['failed', 'ready', 'reporting'].includes(update.status) ? null : undefined,
      processing_error:
        update.error === undefined ? undefined : update.error,
      processed_at:
        update.processedAt === undefined ? undefined : update.processedAt,
    })
    .eq('id', sessionId)

  if (error) {
    logActionError('submitSession.processingState', error)
    return false
  }

  return true
}

export async function getExistingCompletedSessionOutcome(
  sessionId: string,
): Promise<SubmitSessionResult> {
  const db = createAdminClient()
  const { data: session, error: sessionError } = await db.from('participant_sessions')
    .select('processing_status').eq('id', sessionId).single()
  if (sessionError || !session) {
    return { ok: false, error: 'submit_failed', message: ASSESSMENT_PROCESSING_ERROR }
  }
  if (session.processing_status === 'failed') {
    return { ok: false, error: 'scoring_failed', message: ASSESSMENT_PROCESSING_ERROR }
  }
  if (session.processing_status !== 'ready' && session.processing_status !== 'reporting') {
    return { ok: true, outcome: 'report_pending', sessionId, processingStatus: 'scoring' }
  }
  const { data, error } = await db
    .from('report_snapshots')
    .select('status')
    .eq('participant_session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    logActionError('submitSession.reportSnapshots.outcome', error)
    return {
      ok: false,
      error: 'report_failed',
      message: REPORT_PROCESSING_ERROR,
    }
  }

  if (!data) {
    return {
      ok: true,
      outcome: 'completed_no_report',
      sessionId,
      processingStatus: 'ready',
    }
  }

  if (data.status === 'failed') {
    return {
      ok: false,
      error: 'report_failed',
      message: REPORT_PROCESSING_ERROR,
    }
  }

  if (data.status === 'ready' || data.status === 'released') {
    return {
      ok: true,
      outcome: 'ready',
      sessionId,
      processingStatus: 'ready',
    }
  }

  return {
    ok: true,
    outcome: 'report_pending',
    sessionId,
    processingStatus: 'reporting',
  }
}

export async function finalizeCompletedSessionProcessing(input: {
  sessionId: string
  campaignId: string | null
  campaignParticipantId: string | null
  assessmentId: string | null
  completedAt: string
  emitAssessmentCompletedEvent: boolean
  /** Recovery leaves pending snapshots for the same cron's generation sweep. */
  deferReportGeneration?: boolean
}): Promise<SubmitSessionResult> {
  const { data: claimed, error: claimError } = await createAdminClient().rpc('claim_session_processing', {
    p_session_id: input.sessionId,
  })
  if (claimError) {
    logActionError('submitSession.claimProcessing', claimError)
    return { ok: false, error: 'submit_failed', message: ASSESSMENT_PROCESSING_ERROR }
  }
  if (!claimed) return getExistingCompletedSessionOutcome(input.sessionId)

  const scoringStateSet = await markParticipantSessionProcessing(input.sessionId, {
    status: 'scoring',
    error: null,
    processedAt: null,
  })

  if (!scoringStateSet) {
    return {
      ok: false,
      error: 'submit_failed',
      message: 'Unable to update this assessment state right now',
    }
  }

  const scoringResult = await scoreSession(input.sessionId)
  if ('error' in scoringResult) {
    logActionError('submitSession.scoring', scoringResult.error)
    await markParticipantSessionProcessing(input.sessionId, {
      status: 'failed',
      error: scoringResult.error,
      processedAt: null,
    })
    return {
      ok: false,
      error: 'scoring_failed',
      message: ASSESSMENT_PROCESSING_ERROR,
    }
  }

  const scoredStateSet = await markParticipantSessionProcessing(input.sessionId, {
    status: 'scored',
    error: null,
    processedAt: null,
  })

  if (!scoredStateSet) {
    return {
      ok: false,
      error: 'submit_failed',
      message: 'Unable to update this assessment state right now',
    }
  }

  const db = createAdminClient()
  let allDone = false
  const refreshedAccessToken: string | undefined = undefined

  if (input.campaignParticipantId && input.campaignId) {
    const [{ data: required, error: requiredError }, { data: completed, error: completedError }] = await Promise.all([
      db
        .from('campaign_assessments')
        .select('assessment_id')
        .eq('campaign_id', input.campaignId)
        .eq('is_required', true)
        .is('deleted_at', null),
      db
        .from('participant_sessions')
        .select('assessment_id')
        .eq('campaign_participant_id', input.campaignParticipantId)
        .eq('status', 'completed'),
    ])

    if (requiredError || completedError) {
      await markParticipantSessionProcessing(input.sessionId, {
        status: 'failed', error: 'Unable to verify campaign completion', processedAt: null,
      })
      return { ok: false, error: 'submit_failed', message: ASSESSMENT_PROCESSING_ERROR }
    }

    const requiredIds = new Set((required ?? []).map((row) => row.assessment_id))
    const completedIds = new Set((completed ?? []).map((row) => row.assessment_id))
    allDone = [...requiredIds].every((id) => completedIds.has(id))

    if (allDone) {
      // Completion is a durable, retryable state transition. Keep the existing
      // capability valid for reading released reports/recovering processing;
      // completed sessions cannot accept writes. Rotating here made a lost
      // response or subsequent report failure permanently strand the browser.
      const { error: participantUpdateError } = await db
        .from('campaign_participants')
        .update({
          status: 'completed',
          completed_at: input.completedAt,
        })
        .eq('id', input.campaignParticipantId)
        .in('status', PARTICIPANT_COMPLETABLE_STATUSES)
        .select('id')

      if (participantUpdateError) {
        logActionError('submitSession.participantStatus', participantUpdateError)
      }
    }

    if (input.emitAssessmentCompletedEvent && input.assessmentId) {
      try {
        await enqueueAssessmentCompletedEvent({
          sessionId: input.sessionId,
          campaignId: input.campaignId,
          participantId: input.campaignParticipantId,
          assessmentId: input.assessmentId,
          allRequiredAssessmentsCompleted: allDone,
          completedAt: input.completedAt,
        })
      } catch (eventError) {
        console.error('[integrations] Failed to enqueue assessment.completed event:', eventError)
      }
    }
  }

  let participantReportState:
    | {
        hasParticipantReport: boolean
        participantSnapshotStatus: ReportSnapshotStatus | null
        hasPendingSnapshotWork: boolean
      }
    | undefined

  if (input.campaignId) {
    const snapshotState = await ensureReportSnapshotsForSession({
      sessionId: input.sessionId,
      campaignId: input.campaignId,
    })

    if ('error' in snapshotState) {
      await markParticipantSessionProcessing(input.sessionId, {
        status: 'failed',
        error: snapshotState.error,
        processedAt: null,
      })
      return {
        ok: false,
        error: 'report_failed',
        message: REPORT_PROCESSING_ERROR,
      }
    }

    participantReportState = snapshotState

    if (snapshotState.hasPendingSnapshotWork && !input.deferReportGeneration) {
      const triggerResult = await triggerReportGeneration(input.sessionId)
      if (!triggerResult.ok) {
        // Non-fatal: the report-generation-sweep cron picks up pending
        // snapshots, so a failed trigger (rate limit, transient network) just
        // delays the report. Fall through to the 'reporting' state below and
        // let the report page poll. Log so trigger-failure rates stay visible.
        await reportError(new Error(triggerResult.error), {
          source: 'reports.trigger',
          severity: 'warning',
          alert: false,
          context: { session_id: input.sessionId },
        }).catch(() => {
          // Instrumentation must not break the submit path
        })
      }
    }
  }

  if (!participantReportState?.hasParticipantReport) {
    const readyStateSet = await markParticipantSessionProcessing(input.sessionId, {
      status: 'ready',
      error: null,
      processedAt: new Date().toISOString(),
    })

    if (!readyStateSet) {
      return {
        ok: false,
        error: 'submit_failed',
        message: 'Unable to update this assessment state right now',
      }
    }

    return {
      ok: true,
      outcome: 'completed_no_report',
      sessionId: input.sessionId,
      processingStatus: 'ready',
      refreshedAccessToken,
    }
  }

  if (
    participantReportState.participantSnapshotStatus === 'ready' ||
    participantReportState.participantSnapshotStatus === 'released'
  ) {
    const readyStateSet = await markParticipantSessionProcessing(input.sessionId, {
      status: 'ready',
      error: null,
      processedAt: new Date().toISOString(),
    })

    if (!readyStateSet) {
      return {
        ok: false,
        error: 'submit_failed',
        message: 'Unable to update this assessment state right now',
      }
    }

    return {
      ok: true,
      outcome: 'ready',
      sessionId: input.sessionId,
      processingStatus: 'ready',
      refreshedAccessToken,
    }
  }

  const reportingStateSet = await markParticipantSessionProcessing(input.sessionId, {
    status: 'reporting',
    error: null,
    processedAt: null,
  })

  if (!reportingStateSet) {
    return {
      ok: false,
      error: 'submit_failed',
      message: 'Unable to update this assessment state right now',
    }
  }

  return {
    ok: true,
    outcome: 'report_pending',
    sessionId: input.sessionId,
    processingStatus: 'reporting',
    refreshedAccessToken,
  }
}

/**
 * Trigger report generation for any pending snapshots linked to a session.
 *
 * Uses the internal API key to bypass admin auth because this runs from the
 * participant completion flow.
 */
async function triggerReportGeneration(
  sessionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = triggerReportGenerationInputSchema.safeParse({ sessionId })
  if (!parsed.success) {
    return { ok: false, error: 'Invalid session ID' }
  }

  const apiKey = process.env.INTERNAL_API_KEY
  if (!apiKey) {
    console.warn('[reports] INTERNAL_API_KEY not set — skipping auto-generation')
    return { ok: false, error: 'Report generation is not configured right now' }
  }

  try {
    const appUrl = requireAppUrl('admin')
    const response = await fetch(`${appUrl}/api/reports/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': apiKey,
      },
      body: JSON.stringify({ sessionId }),
      // Trigger failure is non-fatal (the sweep cron is the safety net), so
      // don't let a hung internal fetch stall the participant's submit.
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      throw new Error(payload.error ?? 'Auto-generation trigger failed')
    }
    return { ok: true }
  } catch (error) {
    console.error('[reports] Auto-generation trigger failed:', error)
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Auto-generation trigger failed',
    }
  }
}

