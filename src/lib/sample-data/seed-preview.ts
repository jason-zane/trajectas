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

// Re-exports used by other modules
export { synthScore, weightedMean, SAMPLE_SCORING_METHOD }
