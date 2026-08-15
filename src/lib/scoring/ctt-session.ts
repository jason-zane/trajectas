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
import {
  isKeyedItem,
  scoreKeyedResponse,
  type ScorableOption,
} from '@/lib/scoring/keyed-options'

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
  /** The item's options; a non-null scoreValue anywhere makes the item keyed. */
  options: ScorableOption[]
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
 * not the Likert default 1–5. Items with no options (AI-generated items get
 * none) can still derive bounds from binary-style configs: the seeded shape
 * keys option values as `labels` keys ({"0": "No", "1": "Yes"}) and the admin
 * form stores `trueValue`/`falseValue` — the runner's binary component
 * submits 0/1 in both cases. A binary format whose config carries none of
 * those shapes still scores 0–1 — the runner's hardcoded Yes=1/No=0 fallback
 * applies to every option-less binary item. Only after that do we fall back
 * to the config's `points` (Likert) or the 1–5 default.
 */
export function deriveItemBounds(
  config: Record<string, unknown>,
  optionValues: number[],
  formatType?: string,
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
  if (config.labels && typeof config.labels === 'object' && !Array.isArray(config.labels)) {
    const labelValues = Object.keys(config.labels as Record<string, unknown>)
      .map(Number)
      .filter(Number.isFinite)
    if (new Set(labelValues).size >= 2) {
      return {
        minValue: Math.min(...labelValues),
        maxValue: Math.max(...labelValues),
      }
    }
  }
  if (
    typeof config.trueValue === 'number' &&
    typeof config.falseValue === 'number' &&
    config.trueValue !== config.falseValue
  ) {
    return {
      minValue: Math.min(config.trueValue, config.falseValue),
      maxValue: Math.max(config.trueValue, config.falseValue),
    }
  }
  if (formatType === 'binary') {
    return { minValue: cfgMin ?? 0, maxValue: cfgMax ?? 1 }
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
    .select('id, construct_id, reverse_scored, weight, response_format_id, purpose')
    .in('id', itemIds)

  if (itemErr) return { error: itemErr.message }

  // Get response format type + config for min/max values. Fail closed: a
  // failed metadata query must abort scoring, not silently fall back to
  // default bounds/unkeyed scoring — those produce plausible wrong numbers.
  const formatIds = [...new Set((itemRows ?? []).map((i) => i.response_format_id))]
  const { data: formatRows, error: formatErr } = await db
    .from('response_formats')
    .select('id, type, config')
    .in('id', formatIds)

  if (formatErr) return { error: formatErr.message }

  const formatMap = new Map<string, { type: string; config: Record<string, unknown> }>()
  for (const f of formatRows ?? []) {
    formatMap.set(f.id, { type: f.type ?? '', config: f.config ?? {} })
  }

  // Per-item options: the real scoring bounds live on item_options, not the
  // format config — and options carrying score_value make the item keyed.
  const { data: optionRows, error: optionErr } = await db
    .from('item_options')
    .select('item_id, value, score_value, exclude_from_scoring')
    .in('item_id', itemIds)

  if (optionErr) return { error: optionErr.message }

  const optionValuesByItem = new Map<string, number[]>()
  const scorableOptionsByItem = new Map<string, ScorableOption[]>()
  for (const opt of optionRows ?? []) {
    const excluded = opt.exclude_from_scoring ?? false

    // Excluded options ("Don't know") must not define the scoring scale —
    // their (often sentinel) values would stretch the bounds for everyone.
    if (!excluded) {
      const values = optionValuesByItem.get(opt.item_id) ?? []
      values.push(Number(opt.value))
      optionValuesByItem.set(opt.item_id, values)
    }

    const scorable = scorableOptionsByItem.get(opt.item_id) ?? []
    scorable.push({
      value: Number(opt.value),
      scoreValue: opt.score_value == null ? null : Number(opt.score_value),
      excludeFromScoring: excluded,
    })
    scorableOptionsByItem.set(opt.item_id, scorable)
  }

  // Build item metadata map
  const itemMap = new Map<string, ItemMeta>()
  for (const item of itemRows ?? []) {
    if (!item.construct_id) continue

    // LR-6 / #336: practice (and seed/calibration-only) responses must never
    // reach a participant's own POMP score. Before items.purpose gained the
    // 'practice'/'seed' values (20260813100000_cognitive_enums.sql), every
    // item with a construct_id WAS purpose='construct' — the construct_id
    // check above was an adequate implicit filter on its own. It no longer
    // is: items_purpose_construct_check (20260813100500_cognitive_item_bank
    // .sql) requires 'practice' and 'seed' items to ALSO carry a
    // construct_id (so practice items draw from, and seed items calibrate
    // onto, the right bank metric), so an unfiltered read here would
    // silently fold a practice section's responses into the participant's
    // real construct/factor scores for any assessment using CTT/POMP
    // scoring (scoring_profile defaults to 'pomp_factor' — see
    // src/lib/scoring/dispatch.ts — and nothing restricts a 'practice'-role
    // section to ability-scored assessments only). Mirrors the equivalent,
    // already-correct purpose check in the ability-dichotomous path — see
    // classifyEntry's `purpose === 'practice'` branch in
    // src/lib/scoring/ability-scoring.ts.
    if (item.purpose !== 'construct') continue

    const format = formatMap.get(item.response_format_id)

    // Free-text responses are qualitative: the stored response_value is only
    // a presence flag, so letting it into POMP aggregates would drag every
    // construct mean toward 0. Text lives in response_data for later use.
    if (format?.type === 'free_text') continue

    const { minValue, maxValue } = deriveItemBounds(
      format?.config ?? {},
      optionValuesByItem.get(item.id) ?? [],
      format?.type,
    )

    itemMap.set(item.id, {
      id: item.id,
      constructId: item.construct_id,
      reverseScored: item.reverse_scored ?? false,
      weight: item.weight != null ? Number(item.weight) : 1.0,
      minValue,
      maxValue,
      options: scorableOptionsByItem.get(item.id) ?? [],
    })
  }

  // 4. Build construct → items mapping
  const constructItems = new Map<string, { pompValue: number; weight: number }[]>()

  for (const resp of responses) {
    const meta = itemMap.get(resp.item_id)
    if (!meta) continue

    // A chosen exclude_from_scoring option ("Don't know") drops the response
    // from aggregates entirely — keyed or not.
    const selected = meta.options.find(
      (o) => o.value === Number(resp.response_value),
    )
    if (selected?.excludeFromScoring) continue

    let pompValue: number

    // Keyed items score by the key of the chosen option (reverse_scored does
    // not apply — keys encode direction).
    const keyedOutcome = isKeyedItem(meta.options)
      ? scoreKeyedResponse(Number(resp.response_value), meta.options)
      : null

    if (keyedOutcome?.kind === 'scored') {
      pompValue = keyedOutcome.pomp
    } else {
      const rawValue = Number(resp.response_value)

      // A response outside the derived bounds means option values and bounds
      // disagree — a data bug, not participant behaviour. Clamping keeps the
      // score sane, but silently clamping is how the 0-indexed-anchors bug
      // went unnoticed; make it loud so it surfaces in logs immediately.
      if (rawValue < meta.minValue || rawValue > meta.maxValue) {
        console.error(
          `[scoring] Response out of bounds for item ${meta.id} in session ${sessionId}: ` +
            `value=${rawValue}, bounds=${meta.minValue}–${meta.maxValue}. ` +
            `Clamped, but the item's options/bounds need fixing.`,
        )
      }

      const effectiveValue = meta.reverseScored
        ? meta.maxValue - rawValue + meta.minValue
        : rawValue

      // POMP, clamped to 0–100 so a response outside the derived bounds can
      // never push a persisted score negative or above the scale.
      pompValue = toPomp(effectiveValue, meta.minValue, meta.maxValue)
    }

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

  const compositePersisted = await persistCompositeScore(
    db,
    sessionId,
    scoreRows.map((r) => r.scaled_score),
  )
  if (!compositePersisted) {
    return { error: 'Failed to persist the composite score for this session' }
  }

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
): Promise<boolean> {
  if (scaledScores.length === 0) return true
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
    return false
  }
  return true
}
