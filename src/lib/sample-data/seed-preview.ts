// =============================================================================
// src/lib/sample-data/seed-preview.ts — preview seeding for report templates.
//
// Creates/refreshes a fake participant + session + participant_scores per
// assessment under the "Sample Data" client so the report template builder
// can render previews against real-looking data. Score values come from
// synthScore (deterministic). Idempotent.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { synthScore, weightedMean } from './score-synth'

export const PREVIEW_SAMPLE_CLIENT_ID = '00000000-0000-4000-8000-00008a4dc11e'
export const PREVIEW_SAMPLE_EMAIL_DOMAIN = '@trajectas.local'
export const PREVIEW_SAMPLE_PARTICIPANT_FIRST = 'Alex'
export const PREVIEW_SAMPLE_PARTICIPANT_LAST = 'Morgan'

const SAMPLE_SCORING_METHOD = 'ctt'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>

export interface SeedResult {
  campaignId: string
  participantId: string
  sessionId: string
  scoreCount: number
}

/**
 * Returns the well-known Sample Data client id. The migration guarantees the
 * row exists; this function exists so callers don't hardcode the UUID and so
 * we have a single place to swap the ID if needed.
 */
export async function ensurePreviewSampleClient(db: DB): Promise<string> {
  const { data, error } = await db
    .from('clients')
    .select('id')
    .eq('id', PREVIEW_SAMPLE_CLIENT_ID)
    .maybeSingle()
  if (error) throw new Error(`ensurePreviewSampleClient: ${error.message}`)
  if (!data) {
    throw new Error(
      `Sample Data client row missing — apply migration 20260418100000_preview_sample_client.sql`,
    )
  }
  return PREVIEW_SAMPLE_CLIENT_ID
}

export async function hasPreviewSeed(db: DB, assessmentId: string): Promise<boolean> {
  const { data } = await db
    .from('participant_sessions')
    .select('id')
    .eq('assessment_id', assessmentId)
    .eq('client_id', PREVIEW_SAMPLE_CLIENT_ID)
    .maybeSingle()
  return !!data
}

export async function getPreviewSessionId(db: DB, assessmentId: string): Promise<string | null> {
  const { data } = await db
    .from('participant_sessions')
    .select('id')
    .eq('assessment_id', assessmentId)
    .eq('client_id', PREVIEW_SAMPLE_CLIENT_ID)
    .maybeSingle()
  return (data?.id as string | undefined) ?? null
}

/**
 * Idempotently seed (or refresh) the preview sample data for one assessment:
 * campaign, participant, session, and participant_scores rows. Score values
 * come from synthScore (deterministic); matches the shape the production
 * CTT scorer writes so the real report runner can consume them.
 */
export async function seedAssessmentPreview(
  db: DB,
  assessmentId: string,
): Promise<SeedResult> {
  await ensurePreviewSampleClient(db)

  // 1) Load the assessment so we know its title and scoring_level.
  const assessment = await db
    .from('assessments')
    .select('id, title, scoring_level')
    .eq('id', assessmentId)
    .is('deleted_at', null)
    .maybeSingle()
  if (assessment.error) throw new Error(assessment.error.message)
  if (!assessment.data) {
    throw new Error(`seedAssessmentPreview: assessment ${assessmentId} not found`)
  }

  const { title, scoring_level: scoringLevel } = assessment.data as {
    title: string
    scoring_level: 'factor' | 'construct'
  }

  // 2) Upsert campaign (natural key: client_id + slug).
  const campaignSlug = `preview-${assessmentId}`
  const campaignTitle = `Preview Sample — ${title}`
  const existingCampaign = await db
    .from('campaigns')
    .select('id')
    .eq('client_id', PREVIEW_SAMPLE_CLIENT_ID)
    .eq('slug', campaignSlug)
    .maybeSingle()
  let campaignId: string | undefined = existingCampaign.data?.id
  if (!campaignId) {
    const ins = await db
      .from('campaigns')
      .insert({
        client_id: PREVIEW_SAMPLE_CLIENT_ID,
        title: campaignTitle,
        slug: campaignSlug,
        status: 'active',
        brand_mode: 'platform',
      })
      .select('id')
      .single()
    if (ins.error) throw new Error(`seedAssessmentPreview/campaign: ${ins.error.message}`)
    campaignId = ins.data.id
  }

  // 3) Upsert participant (natural key: campaign_id + email).
  const sampleEmail = `sample+${assessmentId}${PREVIEW_SAMPLE_EMAIL_DOMAIN}`
  const existingParticipant = await db
    .from('campaign_participants')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('email', sampleEmail)
    .maybeSingle()
  let participantId: string | undefined = existingParticipant.data?.id
  if (!participantId) {
    const nowIso = new Date().toISOString()
    const ins = await db
      .from('campaign_participants')
      .insert({
        campaign_id: campaignId,
        email: sampleEmail,
        first_name: PREVIEW_SAMPLE_PARTICIPANT_FIRST,
        last_name: PREVIEW_SAMPLE_PARTICIPANT_LAST,
        status: 'completed',
        started_at: nowIso,
        completed_at: nowIso,
      })
      .select('id')
      .single()
    if (ins.error) throw new Error(`seedAssessmentPreview/participant: ${ins.error.message}`)
    participantId = ins.data.id
  }

  // 4) Upsert participant_session (natural key: assessment_id + campaign_participant_id).
  const existingSession = await db
    .from('participant_sessions')
    .select('id')
    .eq('assessment_id', assessmentId)
    .eq('campaign_participant_id', participantId)
    .maybeSingle()
  let sessionId: string | undefined = existingSession.data?.id
  if (!sessionId) {
    const nowIso = new Date().toISOString()
    const ins = await db
      .from('participant_sessions')
      .insert({
        assessment_id: assessmentId,
        campaign_id: campaignId,
        campaign_participant_id: participantId,
        client_id: PREVIEW_SAMPLE_CLIENT_ID,
        status: 'completed',
        started_at: nowIso,
        completed_at: nowIso,
        processing_status: 'ready',
        processed_at: nowIso,
      })
      .select('id')
      .single()
    if (ins.error) throw new Error(`seedAssessmentPreview/session: ${ins.error.message}`)
    sessionId = ins.data.id
  }

  // 5) Clear + reinsert scores. The enum scoring_level is (factor|construct);
  //    dimensions are aggregated at render time and don't get persisted here.
  await db.from('participant_scores').delete().eq('session_id', sessionId)

  const scoreCount = scoringLevel === 'construct'
    ? await seedConstructScores(db, sessionId!, assessmentId)
    : await seedFactorScores(db, sessionId!, assessmentId)

  return {
    campaignId: campaignId!,
    participantId: participantId!,
    sessionId: sessionId!,
    scoreCount,
  }
}

async function seedConstructScores(
  db: DB,
  sessionId: string,
  assessmentId: string,
): Promise<number> {
  const { data, error } = await db
    .from('assessment_constructs')
    .select('construct_id')
    .eq('assessment_id', assessmentId)
  if (error) throw new Error(`seedConstructScores: ${error.message}`)
  const rows = (data ?? []).map((r: { construct_id: string }) => {
    const score = synthScore(r.construct_id)
    return {
      session_id: sessionId,
      construct_id: r.construct_id,
      factor_id: null,
      scoring_level: 'construct' as const,
      scoring_method: SAMPLE_SCORING_METHOD,
      raw_score: score,
      scaled_score: score,
    }
  })
  if (rows.length === 0) return 0
  const ins = await db.from('participant_scores').insert(rows)
  if (ins.error) throw new Error(`seedConstructScores/insert: ${ins.error.message}`)
  return rows.length
}

async function seedFactorScores(
  db: DB,
  sessionId: string,
  assessmentId: string,
): Promise<number> {
  // Load the assessment's factor ids.
  const af = await db
    .from('assessment_factors')
    .select('factor_id')
    .eq('assessment_id', assessmentId)
  if (af.error) throw new Error(`seedFactorScores: ${af.error.message}`)
  const factorIds = (af.data ?? []).map((r: { factor_id: string }) => r.factor_id)
  if (factorIds.length === 0) return 0

  // Load every factor_constructs link for those factors so we can compute a
  // weighted mean of synthetic construct scores per factor.
  const fc = await db
    .from('factor_constructs')
    .select('factor_id, construct_id, weight')
    .in('factor_id', factorIds)
  if (fc.error) throw new Error(`seedFactorScores: ${fc.error.message}`)

  type Link = { factor_id: string; construct_id: string; weight: number }
  const linksByFactor = new Map<string, Link[]>()
  for (const link of (fc.data ?? []) as Link[]) {
    const list = linksByFactor.get(link.factor_id) ?? []
    list.push(link)
    linksByFactor.set(link.factor_id, list)
  }

  const rows = factorIds.map((factorId) => {
    const links = linksByFactor.get(factorId) ?? []
    const score = links.length === 0
      ? synthScore(factorId)
      : weightedMean(
          links.map((l) => ({
            value: synthScore(l.construct_id),
            weight: Number(l.weight),
          })),
        )
    return {
      session_id: sessionId,
      factor_id: factorId,
      construct_id: null,
      scoring_level: 'factor' as const,
      scoring_method: SAMPLE_SCORING_METHOD,
      raw_score: score,
      scaled_score: score,
    }
  })

  if (rows.length === 0) return 0
  const ins = await db.from('participant_scores').insert(rows)
  if (ins.error) throw new Error(`seedFactorScores/insert: ${ins.error.message}`)
  return rows.length
}

// Re-exports used by other modules
export { synthScore, weightedMean, SAMPLE_SCORING_METHOD }
