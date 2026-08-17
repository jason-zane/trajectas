/**
 * Pure, DB-free helpers for dichotomous ability scoring (LR-5 / #335).
 *
 * Kept separate from ability-session.ts (which does the I/O) so outcome
 * classification, latency derivation, and the Response Time Effort
 * arithmetic can be unit-tested directly, with no Supabase client to mock.
 *
 * Rules encoded here are specified in
 * docs/superpowers/specs/2026-08-13-logical-reasoning-build-plan/
 * 05-scoring-and-interpretation.md — §2.1 (not-reached/omitted/wrong, the
 * asymmetry) and §2.3 (rapid-guessing detection). See ability-session.ts for
 * how these are wired to real session data, including documented departures
 * from the spec's assumptions (no per-item "shown" telemetry; answered_at's
 * upsert semantics under allow_back_nav).
 *
 * @module
 */

export type ItemOutcome = 'correct' | 'incorrect' | 'omitted' | 'expired_unseen' | 'excluded'

export type CognitiveKind = 'figural_matrix' | 'deductive'

/**
 * Pre-calibration (and permanent-floor) rapid-guess thresholds,
 * 05-…-interpretation.md §2.3, itself sourced from
 * 03-logical-reasoning-design.md §10: "matrices: response time < 3,000 ms;
 * deductive: response time < 4,000 ms." The spec's post-calibration
 * regime — item-level normative thresholds computed from median response
 * time in a calibration sample — needs a calibration run that does not
 * exist yet at S1 (scoring_profile = 'ability_dichotomous' is exactly the
 * pre-calibration stage), so this scorer always uses the fixed floor. The
 * spec states the fixed floor is also the PERMANENT floor under the
 * item-level scheme (`floor_i` in `T_i = clamp(0.10 × median_RT_i, floor_i,
 * 10000)`), so nothing here needs to change once calibration lands — only
 * scoreSessionAbilityIRT (or a later revision of this scorer) gains the
 * item-level refinement on top of it.
 */
export const RAPID_GUESS_THRESHOLD_MS: Record<CognitiveKind, number> = {
  figural_matrix: 3000,
  deductive: 4000,
}

/**
 * Response Time Effort tiers, 05-…-interpretation.md §2.3:
 *   RTE >= 0.90            -> normal    (no flag)
 *   0.80 <= RTE < 0.90      -> advisory  (`low_effort_advisory`)
 *   RTE < 0.80              -> blocking  (`not_scorable_effort`)
 *
 * `blocking` is computed and persisted (participant_session_flags) by
 * ability-session.ts but NOT wired into score withholding or a retake
 * workflow in this slice — that is explicit product/UX work (a retake
 * offer, a session status, reviewer visibility) beyond dichotomous scoring
 * and the dispatcher. See the migration header
 * (20260813104000_cognitive_scoring.sql) and the implementation report.
 */
export type RTETier = 'normal' | 'advisory' | 'blocking'

export function classifyRTETier(rte: number): RTETier {
  if (rte >= 0.9) return 'normal'
  if (rte >= 0.8) return 'advisory'
  return 'blocking'
}

// ---------------------------------------------------------------------------
// Outcome classification
// ---------------------------------------------------------------------------

/**
 * The highest form position with a saved response, within one section.
 *
 * The runner displays a section's items in position order, and
 * allow_back_nav only ever permits RETURNING to an earlier item — never
 * skipping ahead (src/components/assess/section-wrapper.tsx). So a response
 * at position N is evidence positions 1..N were all displayed to the
 * candidate at some point, even if some were left blank. Unanswered items
 * at or below the mark are therefore 'omitted' (seen, skipped); unanswered
 * items above it are 'expired_unseen' (never reached) — which is only
 * possible when the section ended by expiry before the candidate advanced
 * that far (the completeness gate blocks submission of a non-expired
 * section with unanswered items, so at scoring time an unanswered item in a
 * non-expired section should not exist; see ability-session.ts).
 *
 * A section with zero responses has a mark of 0.
 */
export function highWaterMark(
  entries: { position: number }[],
  answeredPositions: ReadonlySet<number>,
): number {
  let mark = 0
  for (const e of entries) {
    if (answeredPositions.has(e.position)) mark = Math.max(mark, e.position)
  }
  return mark
}

export interface OutcomeClassification {
  outcome: ItemOutcome
  countsTowardScore: boolean
  chosenOptionId: string | null
}

/**
 * Classify a single delivered-form entry into its scored outcome.
 *
 * Two independent ways an entry is excluded, and both are needed:
 *
 *   - **The section it was delivered in.** `assessment_sections.section_role`
 *     is what an author sets in the composition editor when they mark a
 *     section "Practice", and it is the only signal available when the
 *     practice items are ordinary bank items — which is the normal case. A
 *     figural matrix used for practice is the same row in `items` as one used
 *     for scoring; nothing about the item says "practice", only its
 *     placement does. This check was missing until 2026-08-17, so a section
 *     marked Practice was scored anyway.
 *   - **The item's own purpose.** `practice` is always excluded. Only
 *     `construct` and `seed` are ability-keyed (both require an
 *     item_answer_keys row and are scored right/wrong). Any OTHER purpose
 *     (impression_management / infrequency / attention_check —
 *     personality-style validity items that carry no answer key) is also
 *     `excluded` rather than treated as a missing-key abort condition: those
 *     purposes are not expected in a cognitive-scored assessment, but
 *     excluding them defensively means an unrelated validity item
 *     accidentally present in the section can never abort scoring for
 *     everyone else in the cohort.
 */
export function classifyEntry(input: {
  purpose: string
  /**
   * The role of the section this entry was delivered in. Optional so that
   * callers which genuinely have no section context keep the old behaviour,
   * but the scorer always passes it.
   */
  sectionRole?: string | null
  hasResponse: boolean
  resolvedOptionId: string | null
  correctOptionId: string | null
  sectionExpired: boolean
  position: number
  sectionHighWaterMark: number
}): OutcomeClassification {
  const {
    purpose,
    sectionRole,
    hasResponse,
    resolvedOptionId,
    correctOptionId,
    sectionExpired,
    position,
    sectionHighWaterMark,
  } = input

  // Placement first. A section marked Practice or Instructions never
  // contributes, whatever the items in it happen to be.
  if (sectionRole === 'practice' || sectionRole === 'instructions') {
    return { outcome: 'excluded', countsTowardScore: false, chosenOptionId: resolvedOptionId }
  }

  if (purpose === 'practice') {
    return { outcome: 'excluded', countsTowardScore: false, chosenOptionId: resolvedOptionId }
  }

  const isKeyed = purpose === 'construct' || purpose === 'seed'
  if (!isKeyed) {
    return { outcome: 'excluded', countsTowardScore: false, chosenOptionId: resolvedOptionId }
  }

  // Seed items accrue to calibration only (05-…-interpretation.md §2 /
  // 02-platform-architecture.md §5.3) — scored right/wrong for their own
  // outcome row, but never counted in a factor aggregate.
  const countsTowardScore = purpose === 'construct'

  if (hasResponse) {
    const outcome: ItemOutcome =
      resolvedOptionId !== null && correctOptionId !== null && resolvedOptionId === correctOptionId
        ? 'correct'
        : 'incorrect'
    return { outcome, countsTowardScore, chosenOptionId: resolvedOptionId }
  }

  if (sectionExpired && position > sectionHighWaterMark) {
    return { outcome: 'expired_unseen', countsTowardScore, chosenOptionId: null }
  }
  return { outcome: 'omitted', countsTowardScore, chosenOptionId: null }
}

// ---------------------------------------------------------------------------
// Server-derived latency
// ---------------------------------------------------------------------------

export interface LatencyInput {
  itemId: string
  /** `Date.parse(participant_responses.answered_at)`, or null if unset. */
  answeredAtMs: number | null
  /** Client-reported `participant_responses.response_time_ms`, or null. */
  responseTimeMs: number | null
}

export type LatencySource = 'server_gap' | 'client_fallback' | 'none'

export interface LatencyResult {
  itemId: string
  latencyMs: number | null
  source: LatencySource
}

/**
 * Server-derived per-item latency: the gap between an item's `answered_at`
 * and the previous chronological event in its section — the section's
 * server-stamped clock start (`participant_section_states.started_at`) for
 * the first answer, then each prior answer in `answered_at` order.
 *
 * Why not the client-reported `response_time_ms`: `answered_at` is stamped
 * by `now()` inside the SECURITY DEFINER save RPCs
 * (save_response_for_session / save_responses_batch_for_session,
 * 20260813102000) — the client cannot influence it. `response_time_ms` is
 * whatever the client's JS computed and chose to send; a modified client can
 * report any value. Per this issue's instructions, the server signal is
 * preferred whenever the two would disagree. `response_time_ms` is used
 * ONLY as a last-resort fallback for the very first answered item in a
 * section with no server-stamped start (an untimed section — no
 * participant_section_states row — has nothing to anchor the first gap to).
 *
 * Known limitation, stated rather than hidden: LR-M sets
 * `allow_back_nav = true`, so a candidate can revise an earlier answer.
 * `participant_responses.answered_at` reflects the MOST RECENT write to
 * that item (the save RPCs' `ON CONFLICT ... DO UPDATE SET answered_at =
 * now()`), so a revision's computed "latency" is the time since the
 * previous action, not the original read time — it can under- or
 * over-estimate true engagement time on a revised item. This is a real gap
 * against the spec's assumption of a single per-item read time; closing it
 * would need a genuine "item first shown" server timestamp, which nothing
 * in the runner captures today (see the implementation report).
 */
export function computeServerLatencies(
  entries: LatencyInput[],
  sectionStartedAtMs: number | null,
): LatencyResult[] {
  const withTime = entries
    .filter((e) => e.answeredAtMs !== null)
    .sort((a, b) => (a.answeredAtMs as number) - (b.answeredAtMs as number))

  const results = new Map<string, LatencyResult>()
  let prev = sectionStartedAtMs

  for (const e of withTime) {
    if (prev !== null) {
      results.set(e.itemId, {
        itemId: e.itemId,
        latencyMs: Math.max(0, (e.answeredAtMs as number) - prev),
        source: 'server_gap',
      })
    } else {
      results.set(e.itemId, {
        itemId: e.itemId,
        latencyMs: e.responseTimeMs,
        source: e.responseTimeMs !== null ? 'client_fallback' : 'none',
      })
    }
    prev = e.answeredAtMs as number
  }

  return entries.map(
    (e) => results.get(e.itemId) ?? { itemId: e.itemId, latencyMs: null, source: 'none' },
  )
}

export function isRapidGuess(latencyMs: number | null, kind: CognitiveKind): boolean {
  if (latencyMs === null) return false
  return latencyMs < RAPID_GUESS_THRESHOLD_MS[kind]
}

// ---------------------------------------------------------------------------
// Response Time Effort (session-level)
// ---------------------------------------------------------------------------

export interface RTEInputItem {
  countsTowardScore: boolean
  latencyMs: number | null
  kind: CognitiveKind
}

export interface RTEResult {
  rte: number
  itemsUsed: number
  belowThreshold: number
}

/**
 * 05-…-interpretation.md §2.3:
 *   RTE = (count of scored items with RT >= T_i) / items_used
 *
 * `items_used` is every counts_toward_score item, including omitted and
 * expired_unseen ones (which have no latency and therefore never meet
 * "RT >= T_i") — this is the spec's literal formula, not an approximation:
 * an unanswered scored item drags RTE down exactly as a rapid guess does,
 * which is the intended behaviour (a session with many skips is exactly as
 * uninformative about effort as one with many sub-threshold guesses).
 */
export function computeRTE(items: RTEInputItem[]): RTEResult {
  const scored = items.filter((i) => i.countsTowardScore)
  const itemsUsed = scored.length
  if (itemsUsed === 0) return { rte: 1, itemsUsed: 0, belowThreshold: 0 }
  const atOrAbove = scored.filter(
    (i) => i.latencyMs !== null && i.latencyMs >= RAPID_GUESS_THRESHOLD_MS[i.kind],
  ).length
  return { rte: atOrAbove / itemsUsed, itemsUsed, belowThreshold: itemsUsed - atOrAbove }
}
