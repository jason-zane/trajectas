/**
 * Backfill preview sample data (campaign + participant + session + scores) for
 * every active assessment. Idempotent — safe to re-run.
 *
 * Usage: node scripts/backfill-preview-seeds.mjs
 *
 * Mirrors the logic in src/lib/sample-data/seed-preview.ts. Kept in sync by
 * convention (both use the same FNV-1a synthScore + weightedMean formulas).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const env = {}
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PREVIEW_SAMPLE_CLIENT_ID = '00000000-0000-4000-8000-00008a4dc11e'
const SAMPLE_SCORING_METHOD = 'ctt'

function synthScore(entityId, salt = 'sample') {
  const input = `${entityId}:${salt}`
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  const unsigned = hash >>> 0
  return 20 + (unsigned % 71)
}

function weightedMean(items) {
  if (items.length === 0) return 0
  let sum = 0
  let totalWeight = 0
  for (const { value, weight } of items) {
    sum += value * weight
    totalWeight += weight
  }
  if (totalWeight === 0) {
    return Math.round(items.reduce((a, b) => a + b.value, 0) / items.length)
  }
  return Math.round(sum / totalWeight)
}

async function seedOne(assessmentId) {
  const { data: assessment, error: aErr } = await db
    .from('assessments')
    .select('id, title, scoring_level')
    .eq('id', assessmentId)
    .is('deleted_at', null)
    .maybeSingle()
  if (aErr) throw new Error(aErr.message)
  if (!assessment) throw new Error(`assessment ${assessmentId} not found`)

  const { title, scoring_level: scoringLevel } = assessment
  const campaignSlug = `preview-${assessmentId}`
  const campaignTitle = `Preview Sample — ${title}`
  const sampleEmail = `sample+${assessmentId}@trajectas.local`
  const nowIso = new Date().toISOString()

  // Upsert campaign
  let { data: campaign } = await db
    .from('campaigns')
    .select('id')
    .eq('client_id', PREVIEW_SAMPLE_CLIENT_ID)
    .eq('slug', campaignSlug)
    .maybeSingle()
  if (!campaign) {
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
    if (ins.error) throw new Error(`campaign: ${ins.error.message}`)
    campaign = ins.data
  }

  // Upsert participant
  let { data: participant } = await db
    .from('campaign_participants')
    .select('id')
    .eq('campaign_id', campaign.id)
    .eq('email', sampleEmail)
    .maybeSingle()
  if (!participant) {
    const ins = await db
      .from('campaign_participants')
      .insert({
        campaign_id: campaign.id,
        email: sampleEmail,
        first_name: 'Alex',
        last_name: 'Morgan',
        status: 'completed',
        started_at: nowIso,
        completed_at: nowIso,
      })
      .select('id')
      .single()
    if (ins.error) throw new Error(`participant: ${ins.error.message}`)
    participant = ins.data
  }

  // Upsert session
  let { data: session } = await db
    .from('participant_sessions')
    .select('id')
    .eq('assessment_id', assessmentId)
    .eq('campaign_participant_id', participant.id)
    .maybeSingle()
  if (!session) {
    const ins = await db
      .from('participant_sessions')
      .insert({
        assessment_id: assessmentId,
        campaign_id: campaign.id,
        campaign_participant_id: participant.id,
        client_id: PREVIEW_SAMPLE_CLIENT_ID,
        status: 'completed',
        started_at: nowIso,
        completed_at: nowIso,
        processing_status: 'ready',
        processed_at: nowIso,
      })
      .select('id')
      .single()
    if (ins.error) throw new Error(`session: ${ins.error.message}`)
    session = ins.data
  }

  // Clear + reinsert scores
  await db.from('participant_scores').delete().eq('session_id', session.id)

  let rows = []
  if (scoringLevel === 'construct') {
    const { data } = await db
      .from('assessment_constructs')
      .select('construct_id')
      .eq('assessment_id', assessmentId)
    rows = (data ?? []).map((r) => {
      const s = synthScore(r.construct_id)
      return {
        session_id: session.id,
        construct_id: r.construct_id,
        factor_id: null,
        scoring_level: 'construct',
        scoring_method: SAMPLE_SCORING_METHOD,
        raw_score: s,
        scaled_score: s,
      }
    })
  } else {
    const { data: af } = await db
      .from('assessment_factors')
      .select('factor_id')
      .eq('assessment_id', assessmentId)
    const factorIds = (af ?? []).map((r) => r.factor_id)
    const { data: fc } = await db
      .from('factor_constructs')
      .select('factor_id, construct_id, weight')
      .in('factor_id', factorIds)
    const linksByFactor = new Map()
    for (const link of fc ?? []) {
      const l = linksByFactor.get(link.factor_id) ?? []
      l.push(link)
      linksByFactor.set(link.factor_id, l)
    }
    rows = factorIds.map((factorId) => {
      const links = linksByFactor.get(factorId) ?? []
      const score = links.length === 0
        ? synthScore(factorId)
        : weightedMean(links.map((l) => ({
            value: synthScore(l.construct_id),
            weight: Number(l.weight),
          })))
      return {
        session_id: session.id,
        factor_id: factorId,
        construct_id: null,
        scoring_level: 'factor',
        scoring_method: SAMPLE_SCORING_METHOD,
        raw_score: score,
        scaled_score: score,
      }
    })
  }
  if (rows.length > 0) {
    const ins = await db.from('participant_scores').insert(rows)
    if (ins.error) throw new Error(`scores: ${ins.error.message}`)
  }
  console.log(`✔ ${title} — ${rows.length} score rows (session ${session.id})`)
}

async function main() {
  const { data: assessments, error } = await db
    .from('assessments')
    .select('id, title, status')
    .is('deleted_at', null)
  if (error) throw new Error(error.message)

  for (const a of assessments ?? []) {
    try {
      await seedOne(a.id)
    } catch (err) {
      console.warn(`✗ ${a.title} (${a.id}): ${err.message}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
