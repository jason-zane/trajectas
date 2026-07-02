/**
 * CTT session scorer — runs after a participant submits a session.
 *
 * Computes mean POMP scores per factor and persists them to participant_scores.
 * This is the simple, synchronous scoring path; IRT/advanced scoring is deferred.
 *
 * Flow:
 *   participant_responses → items (reverse_scored, weight, construct_id)
 *     → constructs → factor_constructs → factors
 *     → mean POMP per factor → upsert participant_scores
 *
 * @module
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { toPomp } from '@/lib/scoring/transforms'

interface ResponseRow {
  item_id: string
  response_value: number
}

interface ItemMeta {
  id: string
  constructId: string
  reverseScored: boolean
  weight: number
  minValue: number
  maxValue: number
}

interface FactorConstructLink {
  factorId: string
  constructId: string
  weight: number
}

/**
 * Derive an item's scoring bounds.
 *
 * Explicit `minValue`/`maxValue` on the response-format config win. When the
 * config lacks them, the item's own option values define the scale — e.g. the
 * seeded binary format carries no bounds, so its 0/1 options must score 0–1,
 * not the Likert default 1–5. Only when the item has no options either do we
 * fall back to the config's `points` (Likert) or the 1–5 default.
 */
export function deriveItemBounds(
  config: Record<string, unknown>,
  optionValues: number[],
): { minValue: number; maxValue: number } {
  const cfgMin = typeof config.minValue === 'number' ? config.minValue : undefined
  const cfgMax = typeof config.maxValue === 'number' ? config.maxValue : undefined
  if (cfgMin !== undefined && cfgMax !== undefined) {
    return { minValue: cfgMin, maxValue: cfgMax }
  }
  if (optionValues.length > 0) {
    return {
      minValue: Math.min(...optionValues),
      maxValue: Math.max(...optionValues),
    }
  }
  const points = typeof config.points === 'number' ? config.points : 5
  return { minValue: cfgMin ?? 1, maxValue: cfgMax ?? points }
}

/**
 * Score a completed session using CTT (mean POMP per factor).
 *
 * @param sessionId - The participant session to score.
 * @returns Object with success flag or error message.
 */
export async function scoreSessionCTT(
  sessionId: string,
): Promise<{ success: true; scoreCount: number } | { error: string }> {
  const db = createAdminClient()

  // 1. Get session metadata + assessment scoring level
  const { data: session, error: sessionErr } = await db
    .from('participant_sessions')
    .select('assessment_id')
    .eq('id', sessionId)
    .single()

  if (sessionErr || !session) {
    return { error: sessionErr?.message ?? 'Session not found' }
  }

  // 2. Load all responses for this session
  const { data: responseRows, error: respErr } = await db
    .from('participant_responses')
    .select('item_id, response_value')
    .eq('session_id', sessionId)

  if (respErr) return { error: respErr.message }
  if (!responseRows || responseRows.length === 0) {
    return { error: 'No responses were recorded for this session' }
  }

  const responses: ResponseRow[] = responseRows

  // 3. Load item metadata for all responded items
  const itemIds = responses.map((r) => r.item_id)
  const { data: itemRows, error: itemErr } = await db
    .from('items')
    .select('id, construct_id, reverse_scored, weight, response_format_id')
    .in('id', itemIds)

  if (itemErr) return { error: itemErr.message }

  // Get response format configs for min/max values
  const formatIds = [...new Set((itemRows ?? []).map((i) => i.response_format_id))]
  const { data: formatRows } = await db
    .from('response_formats')
    .select('id, config')
    .in('id', formatIds)

  const formatConfigMap = new Map<string, Record<string, unknown>>()
  for (const f of formatRows ?? []) {
    formatConfigMap.set(f.id, f.config ?? {})
  }

  // Per-item option values: for option-based formats (binary, forced choice)
  // the real scoring bounds live on item_options, not the format config.
  const { data: optionRows } = await db
    .from('item_options')
    .select('item_id, value')
    .in('item_id', itemIds)

  const optionValuesByItem = new Map<string, number[]>()
  for (const opt of optionRows ?? []) {
    const existing = optionValuesByItem.get(opt.item_id) ?? []
    existing.push(Number(opt.value))
    optionValuesByItem.set(opt.item_id, existing)
  }

  // Build item metadata map
  const itemMap = new Map<string, ItemMeta>()
  for (const item of itemRows ?? []) {
    if (!item.construct_id) continue

    const config = formatConfigMap.get(item.response_format_id) ?? {}
    const { minValue, maxValue } = deriveItemBounds(
      config,
      optionValuesByItem.get(item.id) ?? [],
    )

    itemMap.set(item.id, {
      id: item.id,
      constructId: item.construct_id,
      reverseScored: item.reverse_scored ?? false,
      weight: item.weight != null ? Number(item.weight) : 1.0,
      minValue,
      maxValue,
    })
  }

  // 4. Build construct → items mapping
  const constructItems = new Map<string, { pompValue: number; weight: number }[]>()

  for (const resp of responses) {
    const meta = itemMap.get(resp.item_id)
    if (!meta) continue

    const effectiveValue = meta.reverseScored
      ? meta.maxValue - Number(resp.response_value) + meta.minValue
      : Number(resp.response_value)

    // POMP, clamped to 0–100 so a response outside the derived bounds can
    // never push a persisted score negative or above the scale.
    const pompValue = toPomp(effectiveValue, meta.minValue, meta.maxValue)

    const existing = constructItems.get(meta.constructId) ?? []
    existing.push({ pompValue, weight: meta.weight })
    constructItems.set(meta.constructId, existing)
  }

  // 5. Compute construct-level scores (weighted mean POMP)
  const constructScores = new Map<string, number>()
  for (const [constructId, items] of constructItems) {
    let weightedSum = 0
    let totalWeight = 0
    for (const item of items) {
      weightedSum += item.pompValue * item.weight
      totalWeight += item.weight
    }
    constructScores.set(constructId, totalWeight > 0 ? weightedSum / totalWeight : 0)
  }

  // 6. Roll up construct scores → factor scores

  // Load factor-construct links for the assessment's factors
  const { data: assessmentFactors } = await db
    .from('assessment_factors')
    .select('factor_id')
    .eq('assessment_id', session.assessment_id)

  const factorIds = (assessmentFactors ?? []).map((af: { factor_id: string }) => af.factor_id)
  if (factorIds.length === 0) {
    return { error: 'No assessment factors are configured for this assessment' }
  }

  const { data: fcRows, error: fcErr } = await db
    .from('factor_constructs')
    .select('factor_id, construct_id, weight')
    .in('factor_id', factorIds)

  if (fcErr) return { error: fcErr.message }

  const factorConstructLinks: FactorConstructLink[] = (fcRows ?? []).map(
    (r: { factor_id: string; construct_id: string; weight: number }) => ({
      factorId: r.factor_id,
      constructId: r.construct_id,
      weight: Number(r.weight),
    }),
  )

  // Compute factor scores (weighted rollup from construct scores)
  const linksByFactor = new Map<string, FactorConstructLink[]>()
  for (const link of factorConstructLinks) {
    const existing = linksByFactor.get(link.factorId) ?? []
    existing.push(link)
    linksByFactor.set(link.factorId, existing)
  }

  const factorScores: {
    factorId: string
    rawScore: number
    scaledScore: number
    itemsUsed: number
  }[] = []

  for (const [factorId, links] of linksByFactor) {
    let weightedSum = 0
    let totalWeight = 0
    let totalItems = 0

    for (const link of links) {
      const cs = constructScores.get(link.constructId)
      if (cs === undefined) continue

      weightedSum += cs * link.weight
      totalWeight += link.weight
      totalItems += (constructItems.get(link.constructId) ?? []).length
    }

    if (totalWeight === 0) continue

    const scaledScore = weightedSum / totalWeight

    factorScores.push({
      factorId,
      rawScore: scaledScore, // For CTT, raw = POMP
      scaledScore,
      itemsUsed: totalItems,
    })
  }

  if (factorScores.length === 0) {
    return { error: 'No factor scores could be calculated for this assessment' }
  }

  // Upsert into participant_scores
  const scoreRows = factorScores.map((fs) => ({
    session_id: sessionId,
    factor_id: fs.factorId,
    raw_score: fs.rawScore,
    scaled_score: fs.scaledScore,
    scoring_method: 'ctt',
  }))

  const { error: upsertErr } = await db
    .from('participant_scores')
    .upsert(scoreRows, { onConflict: 'session_id,factor_id' })

  if (upsertErr) return { error: upsertErr.message }

  await persistCompositeScore(db, sessionId, scoreRows.map((r) => r.scaled_score))

  return { success: true, scoreCount: factorScores.length }
}

/**
 * Composite (overall) score for the session = mean of the scaled scores at the
 * assessment's scoring level. v1 only supports mean-of-children; the method
 * is recorded so we can introduce weighted variants later without losing
 * historical context.
 */
async function persistCompositeScore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  sessionId: string,
  scaledScores: number[],
): Promise<void> {
  if (scaledScores.length === 0) return
  const composite = scaledScores.reduce((a, b) => a + b, 0) / scaledScores.length
  const { error } = await db
    .from('participant_sessions')
    .update({
      composite_score: composite,
      composite_method: 'mean_of_children',
    })
    .eq('id', sessionId)
  if (error) {
    console.error(
      `[scoring] Failed to persist composite_score for session ${sessionId}:`,
      error,
    )
  }
}
