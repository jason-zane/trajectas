/**
 * Dichotomous ability scorer — sum-correct against item_answer_keys.
 *
 * Runs after a participant submits a session whose assessment has
 * `scoring_profile = 'ability_dichotomous'` (dispatched from
 * src/lib/scoring/dispatch.ts, invoked from submitSession exactly where
 * scoreSessionCTT used to be — see that module for the swap).
 *
 * Spec:
 * docs/superpowers/specs/2026-08-13-logical-reasoning-build-plan/
 * 02-platform-architecture.md §4.2, 05-scoring-and-interpretation.md §1-§2.
 *
 * Flow, matching 02-…-architecture.md §4.2 (deviations noted inline where
 * the live schema or an upstream gap forced a different choice — see
 * ability-scoring.ts's doc comments for the outcome/latency rules
 * themselves):
 *
 *   1. Load the session's FROZEN delivered form
 *      (participant_section_forms, via the same getOrCreateSectionForms DAL
 *      getSessionState/session-completeness already use) — never a
 *      re-derivation of "what was delivered".
 *   2. Load item metadata and diff item_version/content_hash against the
 *      frozen entry; abort loudly on drift (the immutability trigger should
 *      make this impossible for calibrated+ items, but the check is the
 *      seatbelt).
 *   3. Load item_answer_keys for every construct/seed item; abort if any is
 *      missing — a missing key must never resolve to "wrong".
 *   4. Load responses, section timing state, and item_options for
 *      value -> option resolution.
 *   5. Classify every entry into exactly one participant_item_outcomes row
 *      (correct/incorrect/omitted/expired_unseen/excluded), with a
 *      server-derived latency and rapid-guess flag.
 *   6. Aggregate counts_toward_score outcomes per factor, upsert
 *      participant_scores (percent-correct, provisional = true — no norm
 *      group exists yet, so nothing norm-referenced is ever written; see
 *      the DB constraints in 20260813104000_cognitive_scoring.sql).
 *   7. Persist the session's composite score (assessment_factors
 *      .composite_weight, NULL = equal weighting) and its Response Time
 *      Effort flag, if advisory or blocking.
 *
 * Two known upstream gaps this scorer works around rather than papers over:
 *
 *   - `items.content_hash` is not written by ANY code path today — not just
 *     "non-cognitive items" as commonly assumed; grepping the repo turns up
 *     no writer at all (only `cognitive_item_specs.content_hash`, a
 *     different column on a different table, is populated by the
 *     generator). The drift check below compares frozen-vs-current hash
 *     ONLY when both are non-null, so today it is a structurally-correct
 *     no-op — it starts working the moment something populates the column,
 *     with no scorer change required.
 *   - There is no server-side "item first shown" timestamp. Latency is
 *     derived from `answered_at` gaps (see ability-scoring.ts), which is a
 *     good proxy but not exact under back-navigation revisions.
 *
 * @module
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateSectionForms } from '@/lib/dal/session-forms'
import {
  classifyEntry,
  classifyRTETier,
  computeRTE,
  computeServerLatencies,
  highWaterMark,
  isRapidGuess,
  type CognitiveKind,
  type ItemOutcome,
} from '@/lib/scoring/ability-scoring'

const SCORER_VERSION = 'ability-sum-correct@1'
const RTE_DETECTOR_VERSION = 'rapid-guess-v1'


interface FormEntryWithSection {
  sectionId: string
  position: number
  itemId: string
  itemVersion: number
  contentHash: string | null
  purpose: string
}

interface ItemMeta {
  id: string
  constructId: string | null
  itemVersion: number
  contentHash: string | null
  familyId: string | null
}

/**
 * The row shape this scorer ever writes to participant_scores. Percentile,
 * confidence interval, theta, and norm-group fields are typed as never
 * present in the object literal — not merely nullable — so a future change
 * that tries to attach a computed percentile at this scoring stage is a
 * visible edit to THIS interface, not a silent addition deep in an upsert
 * call. This is the type-level half of the claims-ladder guardrail; the DB
 * CHECK constraints (participant_scores_norm_referenced_requires_group /
 * ..._norm_group_requires_version, 20260813104000_cognitive_scoring.sql)
 * are the structural backstop if this type is ever loosened without the
 * norm-group data actually existing.
 */
interface AbilityScoreRow {
  session_id: string
  factor_id: string
  raw_score: number
  scaled_score: number
  scoring_method: 'ctt'
  metric: 'percent_correct'
  scoring_variant: string
  raw_correct: number
  items_used: number
  items_attempted: number
  provisional: true
}

/**
 * Score a completed session using dichotomous sum-correct scoring.
 *
 * @param sessionId - The participant session to score.
 * @param options.scoringVariant - Override the persisted `scoring_variant`
 *   label (default `'sum_correct'`). Used by the IRT extension point
 *   (ability-irt-session.ts) to record `'sum_correct_fallback'` when it
 *   falls back to this scorer rather than theta-scoring.
 */
export async function scoreSessionAbility(
  sessionId: string,
  options?: { scoringVariant?: string },
): Promise<{ success: true; scoreCount: number } | { error: string }> {
  const db = createAdminClient()
  const scoringVariant = options?.scoringVariant ?? 'sum_correct'

  // 1. Session metadata.
  const { data: session, error: sessionErr } = await db
    .from('participant_sessions')
    .select('assessment_id, campaign_id')
    .eq('id', sessionId)
    .single()

  if (sessionErr || !session) {
    return { error: sessionErr?.message ?? 'Session not found' }
  }
  const assessmentId = session.assessment_id as string
  const campaignId = (session.campaign_id as string | null) ?? null

  // 2. The frozen delivered form — authoritative for scoring, never
  // recomputed (02-…-architecture.md §4.2 step 1).
  const formsResult = await getOrCreateSectionForms(db, { sessionId, assessmentId, campaignId })
  if ('error' in formsResult) return { error: formsResult.error }

  const entries: FormEntryWithSection[] = []
  for (const [sectionId, form] of formsResult) {
    for (const e of form.entries) {
      entries.push({
        sectionId,
        position: e.position,
        itemId: e.itemId,
        itemVersion: e.itemVersion,
        contentHash: e.contentHash,
        purpose: e.purpose,
      })
    }
  }
  if (entries.length === 0) {
    return { error: 'No items were delivered for this session' }
  }

  const itemIds = [...new Set(entries.map((e) => e.itemId))]
  const sectionIds = [...new Set(entries.map((e) => e.sectionId))]

  // 3. Item metadata, current answer keys, options, responses, section
  // timing state — all in parallel.
  const [itemsResult, responsesResult, sectionStatesResult, sectionRolesResult] = await Promise.all([
    db
      .from('items')
      .select('id, construct_id, item_version, content_hash, family_id')
      .in('id', itemIds),
    db
      .from('participant_responses')
      .select('item_id, section_id, response_value, response_time_ms, answered_at')
      .eq('session_id', sessionId)
      .in('section_id', sectionIds),
    db
      .from('participant_section_states')
      .select('section_id, started_at, deadline_at, finalised_at')
      .eq('session_id', sessionId)
      .in('section_id', sectionIds),
    // Section role decides whether a section contributes at all. It is a
    // property of the PLACEMENT, not of the item: a figural matrix used for
    // practice is the same `items` row as one used for scoring, so
    // `items.purpose` cannot express it and reading only that column scored
    // practice sections as if they counted.
    db
      .from('assessment_sections')
      .select('id, section_role')
      .in('id', sectionIds),
  ])

  if (itemsResult.error) return { error: itemsResult.error.message }
  if (responsesResult.error) return { error: responsesResult.error.message }
  if (sectionStatesResult.error) return { error: sectionStatesResult.error.message }
  if (sectionRolesResult.error) return { error: sectionRolesResult.error.message }

  const sectionRoleById = new Map<string, string>(
    (sectionRolesResult.data ?? []).map((r) => [
      r.id as string,
      (r.section_role as string | null) ?? 'scored',
    ]),
  )

  const itemMetaById = new Map<string, ItemMeta>()
  for (const row of itemsResult.data ?? []) {
    itemMetaById.set(row.id as string, {
      id: row.id as string,
      constructId: (row.construct_id as string | null) ?? null,
      itemVersion: Number(row.item_version),
      contentHash: (row.content_hash as string | null) ?? null,
      familyId: (row.family_id as string | null) ?? null,
    })
  }

  // Drift check (02-…-architecture.md §4.2 step 2). Both known-vacuous
  // today per the module doc comment — kept because it is the seatbelt for
  // the day something upstream starts writing these columns.
  for (const entry of entries) {
    const meta = itemMetaById.get(entry.itemId)
    if (!meta) {
      return {
        error: `Frozen form references item ${entry.itemId}, which no longer exists — scoring aborted`,
      }
    }
    if (meta.itemVersion !== entry.itemVersion) {
      return {
        error: `Item ${entry.itemId} content changed mid-flight (version ${entry.itemVersion} -> ${meta.itemVersion}) — scoring aborted`,
      }
    }
    if (entry.contentHash !== null && meta.contentHash !== null && entry.contentHash !== meta.contentHash) {
      return {
        error: `Item ${entry.itemId} content changed mid-flight (content hash mismatch) — scoring aborted`,
      }
    }
  }

  // 3b. Answer keys — only construct/seed entries are ability-keyed (see
  // ability-scoring.ts#classifyEntry). Loaded via the admin client only;
  // item_answer_keys is service-role only by grant and RLS (20260813100500).
  const keyedItemIds = [
    ...new Set(
      entries
        .filter((e) => {
          const role = sectionRoleById.get(e.sectionId) ?? 'scored'
          if (role === 'practice' || role === 'instructions') return false
          return e.purpose === 'construct' || e.purpose === 'seed'
        })
        .map((e) => e.itemId),
    ),
  ]
  const keysById = new Map<string, string>()
  if (keyedItemIds.length > 0) {
    const { data: keyRows, error: keyErr } = await db
      .from('item_answer_keys')
      .select('item_id, correct_option_id')
      .in('item_id', keyedItemIds)
    if (keyErr) return { error: keyErr.message }
    for (const row of keyRows ?? []) {
      keysById.set(row.item_id as string, row.correct_option_id as string)
    }
    const missingKeys = keyedItemIds.filter((id) => !keysById.has(id))
    if (missingKeys.length > 0) {
      return {
        error: `Missing item_answer_keys for scored item(s): ${missingKeys.join(', ')} — a missing key must never score as wrong, scoring aborted`,
      }
    }
  }

  // Item options, for response_value -> option_id resolution.
  const { data: optionRows, error: optionErr } = await db
    .from('item_options')
    .select('id, item_id, value')
    .in('item_id', itemIds)
  if (optionErr) return { error: optionErr.message }

  const optionsByItem = new Map<string, Map<number, string>>()
  for (const row of optionRows ?? []) {
    const byValue = optionsByItem.get(row.item_id as string) ?? new Map<number, string>()
    byValue.set(Number(row.value), row.id as string)
    optionsByItem.set(row.item_id as string, byValue)
  }

  // Item kind (matrices vs deductive), for the rapid-guess threshold.
  const familyIds = [...new Set([...itemMetaById.values()].map((m) => m.familyId).filter(Boolean))] as string[]
  const kindByFamily = new Map<string, CognitiveKind>()
  if (familyIds.length > 0) {
    const { data: familyRows, error: familyErr } = await db
      .from('item_families')
      .select('id, kind')
      .in('id', familyIds)
    if (familyErr) return { error: familyErr.message }
    for (const row of familyRows ?? []) {
      const kind = row.kind as string
      if (kind === 'figural_matrix' || kind === 'deductive') {
        kindByFamily.set(row.id as string, kind)
      }
    }
  }
  function kindForItem(itemId: string): CognitiveKind {
    const meta = itemMetaById.get(itemId)
    const kind = meta?.familyId ? kindByFamily.get(meta.familyId) : undefined
    // No family (e.g. a hand-authored fixture with no item_families row) ->
    // default to the matrices threshold, the primary LR-M case. Documented,
    // not silent: see the RTE/latency detail persisted per session.
    return kind ?? 'figural_matrix'
  }

  const responseByItem = new Map<
    string,
    { responseValue: number; responseTimeMs: number | null; answeredAt: string | null }
  >()
  for (const row of responsesResult.data ?? []) {
    responseByItem.set(row.item_id as string, {
      responseValue: Number(row.response_value),
      responseTimeMs: row.response_time_ms == null ? null : Number(row.response_time_ms),
      answeredAt: (row.answered_at as string | null) ?? null,
    })
  }

  const sectionStateById = new Map<
    string,
    { startedAt: string | null; deadlineAt: string | null; finalisedAt: string | null }
  >()
  for (const row of sectionStatesResult.data ?? []) {
    sectionStateById.set(row.section_id as string, {
      startedAt: (row.started_at as string | null) ?? null,
      deadlineAt: (row.deadline_at as string | null) ?? null,
      finalisedAt: (row.finalised_at as string | null) ?? null,
    })
  }

  const now = Date.now()

  // 5. Classify every entry, section by section (high-water mark and
  // latency anchoring are section-scoped).
  const entriesBySection = new Map<string, FormEntryWithSection[]>()
  for (const entry of entries) {
    const list = entriesBySection.get(entry.sectionId) ?? []
    list.push(entry)
    entriesBySection.set(entry.sectionId, list)
  }

  type OutcomeRow = {
    session_id: string
    item_id: string
    section_id: string
    outcome: ItemOutcome
    chosen_option_id: string | null
    counts_toward_score: boolean
    item_purpose: string
    item_version: number
    content_hash: string | null
    response_time_ms: number | null
    latency_source: 'server_gap' | 'client_fallback' | 'none'
    rapid_guess: boolean
    scorer_version: string
  }

  const outcomeRows: OutcomeRow[] = []
  const rteInputs: { countsTowardScore: boolean; latencyMs: number | null; kind: CognitiveKind }[] = []

  for (const [sectionId, sectionEntries] of entriesBySection) {
    const state = sectionStateById.get(sectionId) ?? null
    // Mirrors src/lib/dal/session-completeness.ts's expiredSectionIds
    // definition exactly — a section is "expired" once it is finalised, or
    // once its server deadline has passed even if the sweep hasn't
    // finalised it yet.
    const sectionExpired =
      !!state && (state.finalisedAt !== null || (state.deadlineAt !== null && Date.parse(state.deadlineAt) < now))

    const answeredPositions = new Set(
      sectionEntries.filter((e) => responseByItem.has(e.itemId)).map((e) => e.position),
    )
    const mark = highWaterMark(sectionEntries, answeredPositions)

    const sectionStartedAtMs = state?.startedAt ? Date.parse(state.startedAt) : null
    const latencies = computeServerLatencies(
      sectionEntries.map((e) => {
        const resp = responseByItem.get(e.itemId)
        return {
          itemId: e.itemId,
          answeredAtMs: resp?.answeredAt ? Date.parse(resp.answeredAt) : null,
          responseTimeMs: resp?.responseTimeMs ?? null,
        }
      }),
      sectionStartedAtMs,
    )
    const latencyByItem = new Map(latencies.map((l) => [l.itemId, l]))

    for (const entry of sectionEntries) {
      const resp = responseByItem.get(entry.itemId)
      const hasResponse = resp !== undefined
      const resolvedOptionId = resp
        ? optionsByItem.get(entry.itemId)?.get(resp.responseValue) ?? null
        : null
      const correctOptionId = keysById.get(entry.itemId) ?? null

      const classification = classifyEntry({
        purpose: entry.purpose,
        sectionRole: sectionRoleById.get(entry.sectionId) ?? 'scored',
        hasResponse,
        resolvedOptionId,
        correctOptionId,
        sectionExpired,
        position: entry.position,
        sectionHighWaterMark: mark,
      })

      const latency = hasResponse ? latencyByItem.get(entry.itemId) ?? null : null
      const kind = kindForItem(entry.itemId)
      const rapidGuess = hasResponse && isRapidGuess(latency?.latencyMs ?? null, kind)

      outcomeRows.push({
        session_id: sessionId,
        item_id: entry.itemId,
        section_id: entry.sectionId,
        outcome: classification.outcome,
        chosen_option_id: classification.chosenOptionId,
        counts_toward_score: classification.countsTowardScore,
        item_purpose: entry.purpose,
        item_version: entry.itemVersion,
        content_hash: entry.contentHash,
        response_time_ms: latency?.latencyMs ?? null,
        latency_source: latency?.source ?? 'none',
        rapid_guess: rapidGuess,
        scorer_version: SCORER_VERSION,
      })

      if (classification.countsTowardScore) {
        rteInputs.push({
          countsTowardScore: true,
          latencyMs: latency?.latencyMs ?? null,
          kind,
        })
      }
    }
  }

  // Persist per-item outcomes before touching participant_scores — if this
  // fails, no aggregate score should exist either.
  const { error: outcomesErr } = await db
    .from('participant_item_outcomes')
    .upsert(outcomeRows, { onConflict: 'session_id,item_id' })
  if (outcomesErr) return { error: outcomesErr.message }

  // 6. Aggregate counts_toward_score outcomes per factor.
  const { data: assessmentFactors, error: afErr } = await db
    .from('assessment_factors')
    .select('factor_id, composite_weight')
    .eq('assessment_id', assessmentId)
  if (afErr) return { error: afErr.message }

  const factorIds = (assessmentFactors ?? []).map((r) => r.factor_id as string)
  if (factorIds.length === 0) {
    return { error: 'No assessment factors are configured for this assessment' }
  }
  const compositeWeightByFactor = new Map<string, number | null>(
    (assessmentFactors ?? []).map((r) => [
      r.factor_id as string,
      r.composite_weight == null ? null : Number(r.composite_weight),
    ]),
  )

  const { data: fcRows, error: fcErr } = await db
    .from('factor_constructs')
    .select('factor_id, construct_id')
    .in('factor_id', factorIds)
  if (fcErr) return { error: fcErr.message }

  const factorsByConstruct = new Map<string, string[]>()
  for (const row of fcRows ?? []) {
    const constructId = row.construct_id as string
    const list = factorsByConstruct.get(constructId) ?? []
    list.push(row.factor_id as string)
    factorsByConstruct.set(constructId, list)
  }

  const agg = new Map<string, { correct: number; itemsUsed: number; itemsAttempted: number }>()
  for (const row of outcomeRows) {
    if (!row.counts_toward_score) continue
    const meta = itemMetaById.get(row.item_id)
    if (!meta?.constructId) continue
    const factorIdsForConstruct = factorsByConstruct.get(meta.constructId) ?? []
    for (const factorId of factorIdsForConstruct) {
      const entryAgg = agg.get(factorId) ?? { correct: 0, itemsUsed: 0, itemsAttempted: 0 }
      entryAgg.itemsUsed += 1
      if (row.outcome === 'correct') entryAgg.correct += 1
      if (row.outcome === 'correct' || row.outcome === 'incorrect') entryAgg.itemsAttempted += 1
      agg.set(factorId, entryAgg)
    }
  }

  const scoreRows: AbilityScoreRow[] = []
  for (const [factorId, a] of agg) {
    if (a.itemsUsed === 0) continue
    scoreRows.push({
      session_id: sessionId,
      factor_id: factorId,
      raw_score: a.correct,
      scaled_score: (100 * a.correct) / a.itemsUsed,
      scoring_method: 'ctt', // sum-correct ability scoring is still classical test theory
      metric: 'percent_correct',
      scoring_variant: scoringVariant,
      raw_correct: a.correct,
      items_used: a.itemsUsed,
      items_attempted: a.itemsAttempted,
      provisional: true,
    })
  }

  if (scoreRows.length === 0) {
    return { error: 'No factor scores could be calculated for this assessment' }
  }

  const { error: upsertErr } = await db
    .from('participant_scores')
    .upsert(scoreRows, { onConflict: 'session_id,factor_id' })
  if (upsertErr) return { error: upsertErr.message }

  // 7a. Composite (02-…-architecture.md §4.2 step 9). NULL composite_weight
  // = equal weighting (weight 1) — a no-op for every factor configured
  // before that column existed. No composite is written for a single-factor
  // assessment beyond that factor's own score (matches ctt-session.ts's
  // mean-of-one behaviour).
  let weightedSum = 0
  let totalWeight = 0
  let anyWeightConfigured = false
  for (const row of scoreRows) {
    const configured = compositeWeightByFactor.get(row.factor_id) ?? null
    const weight = configured ?? 1
    if (configured !== null) anyWeightConfigured = true
    weightedSum += row.scaled_score * weight
    totalWeight += weight
  }
  if (totalWeight > 0) {
    const { error: compositeErr } = await db
      .from('participant_sessions')
      .update({
        composite_score: weightedSum / totalWeight,
        composite_method: anyWeightConfigured ? 'weighted_lr_v1' : 'mean_of_children',
      })
      .eq('id', sessionId)
    if (compositeErr) {
      console.error(`[scoring] Failed to persist composite_score for session ${sessionId}:`, compositeErr)
      return { error: 'Failed to persist the composite score for this session' }
    }
  }

  // 7b. Response Time Effort — session-level, across every counts_toward_score
  // item regardless of factor (05-…-interpretation.md §2.3). Only advisory
  // and blocking tiers are persisted; see participant_session_flags' table
  // comment for why "blocking" does not withhold the score in this slice.
  const rte = computeRTE(rteInputs)
  const tier = classifyRTETier(rte.rte)
  if (rte.itemsUsed > 0 && tier !== 'normal') {
    const { error: flagErr } = await db.from('participant_session_flags').upsert(
      [
        {
          session_id: sessionId,
          flag_code: 'rapid_guess_rate',
          tier: tier === 'blocking' ? 'blocking' : 'advisory',
          detail: {
            rte: rte.rte,
            itemsUsed: rte.itemsUsed,
            belowThreshold: rte.belowThreshold,
          },
          detector_version: RTE_DETECTOR_VERSION,
        },
      ],
      { onConflict: 'session_id,flag_code' },
    )
    if (flagErr) {
      // Non-fatal: the score itself is valid and already persisted. Losing
      // the flag loses an advisory signal, not correctness.
      console.error(`[scoring] Failed to persist rapid_guess_rate flag for session ${sessionId}:`, flagErr)
    }
  }

  return { success: true, scoreCount: scoreRows.length }
}
