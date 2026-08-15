/**
 * Compose the canonical LR-M (figural matrices) assessment from an
 * already-ingested item bank.
 *
 * IDEMPOTENT. Not merely "safe to re-run" — a second invocation against an
 * unchanged bank converges on byte-identical rows and reports
 * `changed: false`. Every write is keyed on a fixed UUID or a natural unique
 * key (`assessment_section_items (section_id, item_id)`), and item selection
 * is a pure function of the bank ordered by
 * `(item_families.predicted_b, item_families.code, items.content_hash)`, all
 * of which are stable across runs. Re-running after the bank has GROWN will
 * recompute the form; the script refuses to do that once anyone has sat the
 * assessment (see `--force` below).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS SCRIPT EXISTS
 * ---------------------------------------------------------------------------
 * Everything needed to deliver, time, score and report a figural-matrix test
 * shipped in LR-1..LR-8. Nothing could ASSEMBLE one: no admin surface writes
 * `assessments.scoring_profile` or `assessment_sections.section_role`, and
 * both default to the wrong value for an ability test
 * (`pomp_factor` -> `scoreSessionCTT`; `scored` -> no practice section, so
 * LR-6's practice gate can never engage). This script is the assembly path.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT BUILDS (doc 03-logical-reasoning-design.md §2, §9, §10;
 * doc 02-platform-architecture.md §1.5, §5)
 * ---------------------------------------------------------------------------
 *   taxonomy   dimension "Cognitive Ability"
 *                └ factor "Logical Reasoning — Inductive" (LR-M)
 *                    └ factor_constructs -> the bank's construct
 *              + an `assessment_factors` row. This is NOT optional dressing:
 *                `scoreSessionAbility` returns "No assessment factors are
 *                configured for this assessment" without it
 *                (src/lib/scoring/ability-session.ts:441), and
 *                `participant_scores.factor_id` is NOT NULL.
 *
 *   assessment scoring_profile = 'ability_dichotomous'  -> scoreSessionAbility
 *              (src/lib/scoring/dispatch.ts:66)
 *              item_selection_strategy = 'fixed', format_mode = 'traditional'
 *
 *   section 0  section_role = 'practice', 2 items from the easiest
 *              difficulty-prior band, `items.purpose = 'practice'`,
 *              NO time limit, allow_back_nav = true, item_ordering = 'fixed'
 *
 *   section 1  section_role = 'scored', 18 items spread across the four
 *              difficulty-prior bands in ascending order of predicted b,
 *              time_limit_seconds = 1440 (24 min — doc 03 §10's
 *              Σ(target RT) × 1.25 figure for the 18-item LR-M form)
 *
 * `items.purpose` is what excludes practice items from scoring
 * (src/lib/scoring/ability-scoring.ts:134) — the SECTION role alone does not.
 * So the two chosen practice items are PROMOTED to `purpose = 'practice'`,
 * which permanently retires them from any scored form. That is the intended
 * one-way door (a practice item's key is revealed to the candidate by
 * `checkPracticeAnswer`), but it is a bank mutation, so the script names the
 * items it is about to convert and counts them in its report.
 *
 * ---------------------------------------------------------------------------
 * WHY psql AND NOT SUPABASE
 * ---------------------------------------------------------------------------
 * Same reason as `ingest-roundtrip.ts`: the production store speaks PostgREST
 * via the Supabase client, which needs a running stack, which needs Docker —
 * unavailable in the environment this was written in (see
 * scripts/README-pg-migrate-check.md). Talking to Postgres directly also means
 * every CHECK constraint, trigger and FK in the real schema fires. Point it at
 * any Postgres, including a Supabase project's direct connection:
 *
 *   # local throwaway cluster (scripts/pg-migrate-check.sh --fresh --keep-running)
 *   node --import ./scripts/cognitive/register-ts-loader.mjs \
 *     scripts/cognitive/seed-lrm-assessment.ts --host=/tmp/pg-migrate-check/run
 *
 *   # a real project
 *   PGPASSWORD=... node --import ./scripts/cognitive/register-ts-loader.mjs \
 *     scripts/cognitive/seed-lrm-assessment.ts \
 *     --conn='postgresql://postgres@db.<ref>.supabase.co:5432/postgres'
 *
 * Flags:
 *   --conn=<uri>          full libpq URI (overrides --host/--port/--user/--db)
 *   --host= --port= --user= --db=     defaults: /tmp/pg-migrate-check/run 55432 postgres postgres
 *   --construct=<uuid>    disambiguate when the bank spans several constructs
 *   --activate            set assessments.status = 'active' (default: draft)
 *   --dry-run             plan and report; write nothing
 *   --force               rewrite the form even though a participant has
 *                         already been served a frozen form for it
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SCRIPT DELIBERATELY DOES NOT DO
 * ---------------------------------------------------------------------------
 * - It does not touch `items.lifecycle_state`. Freshly ingested bank items sit
 *   at 'draft' and have had no content or fairness sign-off
 *   (`item_reviews`, 20260814110000). The runner does not filter on lifecycle,
 *   so the assessment is takeable regardless — but a form built from
 *   unreviewed items is a PILOT form, and the report flags that. Walking items
 *   to 'operational' means recording real human reviews; a seed script must
 *   not fabricate them.
 * - It does not set `items.status = 'active'`. That flag governs the *other*
 *   builder's auto-selection (`persistSections`), and flipping it would make
 *   these items eligible for automatic inclusion in unrelated assessments.
 * - It does not attach the assessment to a campaign. Delivery needs a campaign
 *   + participant; that is a separate, tenant-specific step.
 */
import { execFileSync } from 'node:child_process'

// ---------------------------------------------------------------------------
// Blueprint — doc 03-logical-reasoning-design.md §2 (18 + 2 practice), §10
// (24-minute section limit), doc 02-platform-architecture.md §5.1.
// ---------------------------------------------------------------------------

type Band = 'easy' | 'moderate' | 'hard' | 'very_hard'

const BANDS: readonly Band[] = ['easy', 'moderate', 'hard', 'very_hard']

/** How many SCORED items to draw from each difficulty-prior band. Sums to 18. */
const SCORED_BLUEPRINT: Record<Band, number> = {
  easy: 4,
  moderate: 5,
  hard: 5,
  very_hard: 4,
}

const SCORED_ITEM_TARGET = BANDS.reduce((n, b) => n + SCORED_BLUEPRINT[b], 0)

/** Two unscored practice items with feedback, easiest band (doc 03 §2). */
const PRACTICE_ITEM_TARGET = 2

/** Σ(per-item target RTs) × 1.25, rounded up = 24 minutes (doc 03 §10 table). */
const SCORED_TIME_LIMIT_SECONDS = 24 * 60

/** Fixed identities — the whole idempotency story rests on these. */
const IDS = {
  dimension: '1c000000-0000-0000-0000-000000000001',
  factor: '1c000000-0000-0000-0000-000000000002',
  assessment: '1c000000-0000-0000-0000-000000000011',
  practiceSection: '1c000000-0000-0000-0000-000000000021',
  scoredSection: '1c000000-0000-0000-0000-000000000022',
} as const

const ASSESSMENT_SLUG = 'lr-m-figural-matrices-v1'
const FACTOR_SLUG = 'logical-reasoning-inductive'
const DIMENSION_SLUG = 'cognitive-ability'

// ---------------------------------------------------------------------------
// CLI + psql plumbing (mirrors ingest-roundtrip.ts)
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const arg of argv) {
    const m = /^--([a-zA-Z-]+)(?:=(.*))?$/.exec(arg)
    if (m) out[m[1]] = m[2] ?? 'true'
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const CONN = args.conn ?? null
const HOST = args.host ?? `${process.env.TMPDIR ?? '/tmp'}/pg-migrate-check/run`
const PORT = args.port ?? '55432'
const USER = args.user ?? 'postgres'
const DB = args.db ?? 'postgres'
const DRY_RUN = args['dry-run'] === 'true'
const FORCE = args.force === 'true'
const ACTIVATE = args.activate === 'true'
const CONSTRUCT_OVERRIDE = args.construct ?? null

function connArgs(): string[] {
  return CONN ? [CONN] : ['-h', HOST, '-p', PORT, '-U', USER, '-d', DB]
}

/** Single-value / single-column read. Returns trimmed raw output. */
function sql(text: string): string {
  return execFileSync('psql', [...connArgs(), '-v', 'ON_ERROR_STOP=1', '-tAqc', text], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim()
}

/** Multi-column read, `|`-separated (matching ingest-roundtrip.ts's style). */
function rows(text: string): string[][] {
  const out = sql(text)
  if (!out) return []
  return out.split('\n').map((line) => line.split('|'))
}

/** Run a whole script atomically. Either every statement lands or none does. */
function execScript(script: string): void {
  execFileSync('psql', [...connArgs(), '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-q', '-f', '-'], {
    encoding: 'utf8',
    input: script,
    maxBuffer: 64 * 1024 * 1024,
  })
}

function lit(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return `'${value.replace(/'/g, "''")}'`
}

/** `= ANY(ARRAY[...]::uuid[])` — a bare `IN (...)` list cannot be cast wholesale. */
function uuidArray(values: readonly string[]): string {
  return `ARRAY[${values.map(lit).join(',')}]::uuid[]`
}

function fail(message: string): never {
  console.error(`\nFAILED: ${message}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Read the bank
// ---------------------------------------------------------------------------

type BankItem = {
  itemId: string
  familyCode: string
  band: Band
  predictedB: number
  purpose: string
  keySlot: string
  responseFormatId: string
  constructId: string
  lifecycleState: string
}

/**
 * Every deliverable figural-matrix item: it must have a renderable spec
 * (`cognitive_item_specs`), an answer key (`item_answer_keys` — the ability
 * scorer ABORTS the whole session rather than score a keyless item as wrong,
 * ability-session.ts:249), and a family carrying the difficulty prior the
 * blueprint selects on.
 *
 * `lifecycle_state` is reported, not filtered on, EXCEPT for the two states
 * that mean "never serve this again".
 */
function loadBank(constructId: string): BankItem[] {
  return rows(`
    SELECT i.id, f.code, f.band, f.predicted_b, i.purpose::text, o.label,
           i.response_format_id, i.construct_id, i.lifecycle_state::text
      FROM items i
      JOIN item_families f       ON f.id = i.family_id
      JOIN item_answer_keys ak   ON ak.item_id = i.id
      JOIN item_options o        ON o.id = ak.correct_option_id
     WHERE f.kind = 'figural_matrix'
       AND i.construct_id = ${lit(constructId)}::uuid
       AND i.deleted_at IS NULL
       -- Only states reachable after BOTH sign-offs. 20260815091500 refuses to
       -- link anything else, so selecting a draft here would fail at the INSERT
       -- with a trigger error instead of reporting an honest shortfall.
       AND i.lifecycle_state IN ('piloting','calibrated','operational')
       AND f.band IS NOT NULL
       AND EXISTS (SELECT 1 FROM cognitive_item_specs s WHERE s.item_id = i.id)
     ORDER BY f.predicted_b, f.code, i.content_hash
  `).map(([itemId, familyCode, band, predictedB, purpose, keySlot, rfId, cId, lifecycle]) => ({
    itemId,
    familyCode,
    band: band as Band,
    predictedB: Number(predictedB),
    purpose,
    keySlot,
    responseFormatId: rfId,
    constructId: cId,
    lifecycleState: lifecycle,
  }))
}

function resolveConstructId(): string {
  if (CONSTRUCT_OVERRIDE) return CONSTRUCT_OVERRIDE
  const found = rows(`
    SELECT i.construct_id, count(*)
      FROM items i JOIN item_families f ON f.id = i.family_id
     WHERE f.kind = 'figural_matrix' AND i.deleted_at IS NULL AND i.construct_id IS NOT NULL
     GROUP BY 1 ORDER BY 2 DESC
  `)
  if (found.length === 0) {
    fail(
      'no figural-matrix items found. Ingest a bank first — see scripts/cognitive/generate-matrix-bank.ts ' +
        'and scripts/cognitive/ingest-roundtrip.ts.',
    )
  }
  if (found.length > 1) {
    fail(
      `the bank spans ${found.length} constructs (${found.map((r) => `${r[0]}:${r[1]}`).join(', ')}). ` +
        'Pass --construct=<uuid> to say which one this assessment measures.',
    )
  }
  return found[0][0]
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

type Plan = {
  practice: BankItem[]
  scored: BankItem[]
  toPromote: BankItem[]
  shortfalls: string[]
}

/**
 * Deterministic, and stable under re-run: the bank arrives pre-sorted on
 * (predicted_b, family code, content_hash), and every step below preserves
 * that order. Anything already linked to THIS assessment's practice section
 * stays a practice item, so a re-run never reshuffles the practice pair just
 * because promoting them changed their `purpose`.
 */
function planForm(bank: BankItem[], alreadyPractice: Set<string>): Plan {
  const shortfalls: string[] = []

  const pinnedPractice = bank.filter((i) => alreadyPractice.has(i.itemId))
  const easiestBand = bank.length > 0 ? bank[0].band : 'easy'
  const practicePool = bank.filter(
    (i) => !alreadyPractice.has(i.itemId) && i.band === easiestBand && i.purpose !== 'practice',
  )

  const practice = [...pinnedPractice]
  for (const item of practicePool) {
    if (practice.length >= PRACTICE_ITEM_TARGET) break
    practice.push(item)
  }
  if (practice.length < PRACTICE_ITEM_TARGET) {
    shortfalls.push(
      `practice: wanted ${PRACTICE_ITEM_TARGET} from the '${easiestBand}' band, found ${practice.length}`,
    )
  }

  const practiceIds = new Set(practice.map((i) => i.itemId))
  const scoredPool = bank.filter((i) => !practiceIds.has(i.itemId) && i.purpose !== 'practice')

  const byBand = new Map<Band, BankItem[]>(BANDS.map((b) => [b, []]))
  for (const item of scoredPool) byBand.get(item.band)?.push(item)

  // Within a band, pick greedily against the running key-position and family
  // histograms rather than taking the first N. Doc 03 §9.2 wants each key
  // position used an equal number of times ±1 across the form; taking the
  // bank's natural order instead would leave whatever imbalance the generator
  // happened to produce. Ties fall back to the deterministic bank order, so
  // the result is still a pure function of the bank.
  const keyCount: Record<string, number> = {}
  const familyCount: Record<string, number> = {}
  const scored: BankItem[] = []
  for (const band of BANDS) {
    const want = SCORED_BLUEPRINT[band]
    const remaining = [...(byBand.get(band) ?? [])]
    let taken = 0
    while (taken < want && remaining.length > 0) {
      let best = 0
      for (let i = 1; i < remaining.length; i++) {
        const a = remaining[i]
        const b = remaining[best]
        const byKey = (keyCount[a.keySlot] ?? 0) - (keyCount[b.keySlot] ?? 0)
        if (byKey !== 0) {
          if (byKey < 0) best = i
          continue
        }
        if ((familyCount[a.familyCode] ?? 0) < (familyCount[b.familyCode] ?? 0)) best = i
      }
      const [picked] = remaining.splice(best, 1)
      keyCount[picked.keySlot] = (keyCount[picked.keySlot] ?? 0) + 1
      familyCount[picked.familyCode] = (familyCount[picked.familyCode] ?? 0) + 1
      scored.push(picked)
      taken++
    }
    if (taken < want) {
      shortfalls.push(`band '${band}': wanted ${want} scored items, found ${taken}`)
    }
  }

  // Top up from whatever the bank has left, nearest bands first, rather than
  // silently shipping a short form. A short form is still reported.
  if (scored.length < SCORED_ITEM_TARGET) {
    const chosen = new Set(scored.map((i) => i.itemId))
    for (const item of scoredPool) {
      if (scored.length >= SCORED_ITEM_TARGET) break
      if (!chosen.has(item.itemId)) {
        scored.push(item)
        chosen.add(item.itemId)
      }
    }
  }

  // Ascending difficulty — a power test opens easy so that early failures are
  // informative rather than demoralising (doc 03 §10).
  scored.sort(
    (a, b) =>
      a.predictedB - b.predictedB ||
      a.familyCode.localeCompare(b.familyCode) ||
      a.itemId.localeCompare(b.itemId),
  )

  return {
    practice,
    scored,
    toPromote: practice.filter((i) => i.purpose !== 'practice'),
    shortfalls,
  }
}

/**
 * Doc 03 §9 rule 2: "no more than two consecutive items sharing a key
 * position, verified mechanically at form assembly". Swaps are constrained to
 * items in the SAME band so the ascending-difficulty ordering survives intact.
 * Best effort — the caller reports whether it converged rather than failing
 * the seed over a bank too thin to satisfy it.
 */
function breakKeyRuns(scored: BankItem[]): { order: BankItem[]; violations: number } {
  const order = [...scored]
  for (let pass = 0; pass < 4; pass++) {
    let swapped = false
    for (let i = 2; i < order.length; i++) {
      if (order[i].keySlot !== order[i - 1].keySlot || order[i].keySlot !== order[i - 2].keySlot) {
        continue
      }
      const partner = order.findIndex(
        (cand, j) =>
          j !== i &&
          cand.band === order[i].band &&
          cand.keySlot !== order[i].keySlot &&
          (j < 2 || order[j - 1].keySlot !== order[i].keySlot || order[j - 2].keySlot !== order[i].keySlot),
      )
      if (partner === -1) continue
      ;[order[i], order[partner]] = [order[partner], order[i]]
      swapped = true
    }
    if (!swapped) break
  }

  let violations = 0
  for (let i = 2; i < order.length; i++) {
    if (order[i].keySlot === order[i - 1].keySlot && order[i].keySlot === order[i - 2].keySlot) {
      violations++
    }
  }
  return { order, violations }
}

/** predicted_b is NUMERIC, so it round-trips as e.g. -0.8999999999999999. */
function bStr(value: number): string {
  return value.toFixed(2).padStart(5)
}

function histogram(values: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const v of values) out[v] = (out[v] ?? 0) + 1
  return out
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

function buildScript(plan: Plan, scoredOrder: BankItem[], responseFormatId: string, constructId: string): string {
  const s: string[] = []

  // --- taxonomy (doc 02 §1.5) --------------------------------------------
  s.push(`
INSERT INTO dimensions (id, name, slug, description, display_order, is_scored, is_active)
VALUES (${lit(IDS.dimension)}::uuid, 'Cognitive Ability', ${lit(DIMENSION_SLUG)},
        'General mental ability constructs measured by objectively-keyed ability tests.', 0, true, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug,
  description = EXCLUDED.description, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active;`)

  s.push(`
INSERT INTO factors (id, name, slug, description, dimension_id, is_active, is_match_eligible)
VALUES (${lit(IDS.factor)}::uuid, 'Logical Reasoning — Inductive', ${lit(FACTOR_SLUG)},
        'LR-M. Inferring the rules governing a 3x3 figural matrix and selecting the option that completes it.',
        ${lit(IDS.dimension)}::uuid, true, false)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug,
  description = EXCLUDED.description, dimension_id = EXCLUDED.dimension_id, is_active = EXCLUDED.is_active;`)

  s.push(`
INSERT INTO factor_constructs (factor_id, construct_id, weight, display_order)
VALUES (${lit(IDS.factor)}::uuid, ${lit(constructId)}::uuid, 1.0, 0)
ON CONFLICT (factor_id, construct_id) DO UPDATE SET weight = EXCLUDED.weight,
  display_order = EXCLUDED.display_order;`)

  // --- assessment ---------------------------------------------------------
  // scoring_method stays 'ctt' — sum-correct ability scoring IS classical test
  // theory; scoring_profile is the dispatch key (dispatch.ts header).
  s.push(`
INSERT INTO assessments (id, title, slug, description, scoring_method, scoring_profile,
                         item_selection_strategy, status, time_limit_minutes, format_mode, creation_mode)
VALUES (${lit(IDS.assessment)}::uuid,
        'Logical Reasoning — Figural Matrices (LR-M v1)',
        ${lit(ASSESSMENT_SLUG)},
        'Pilot LR-M form: ${PRACTICE_ITEM_TARGET} practice items with feedback, then ${SCORED_ITEM_TARGET} scored 3x3 matrix items under a ${SCORED_TIME_LIMIT_SECONDS / 60}-minute limit.',
        'ctt', 'ability_dichotomous', 'fixed', ${lit(ACTIVATE ? 'active' : 'draft')}::assessment_status,
        ${SCORED_TIME_LIMIT_SECONDS / 60}, 'traditional', 'manual')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, slug = EXCLUDED.slug,
  description = EXCLUDED.description, scoring_method = EXCLUDED.scoring_method,
  scoring_profile = EXCLUDED.scoring_profile,
  item_selection_strategy = EXCLUDED.item_selection_strategy, status = EXCLUDED.status,
  time_limit_minutes = EXCLUDED.time_limit_minutes, format_mode = EXCLUDED.format_mode,
  deleted_at = NULL;`)

  s.push(`
INSERT INTO assessment_factors (assessment_id, factor_id, display_order, weight, item_count, composite_weight)
VALUES (${lit(IDS.assessment)}::uuid, ${lit(IDS.factor)}::uuid, 0, 1.0, ${scoredOrder.length}, NULL)
ON CONFLICT (assessment_id, factor_id) DO UPDATE SET display_order = EXCLUDED.display_order,
  weight = EXCLUDED.weight, item_count = EXCLUDED.item_count;`)

  // --- sections -----------------------------------------------------------
  // start_section_for_session nulls the limit for a practice section whatever
  // the column says (20260813102000), but storing NULL keeps the row honest.
  s.push(`
INSERT INTO assessment_sections (id, assessment_id, response_format_id, title, instructions,
                                 display_order, item_ordering, time_limit_seconds, section_role,
                                 grace_seconds, allow_back_nav)
VALUES (${lit(IDS.practiceSection)}::uuid, ${lit(IDS.assessment)}::uuid, ${lit(responseFormatId)}::uuid,
        'Practice',
        'Choose the option that completes the pattern. You will be told whether each answer is right before you continue. These questions are not scored, and they are not timed.',
        0, 'fixed', NULL, 'practice', 20, true)
ON CONFLICT (id) DO UPDATE SET assessment_id = EXCLUDED.assessment_id,
  response_format_id = EXCLUDED.response_format_id, title = EXCLUDED.title,
  instructions = EXCLUDED.instructions, display_order = EXCLUDED.display_order,
  item_ordering = EXCLUDED.item_ordering, time_limit_seconds = EXCLUDED.time_limit_seconds,
  section_role = EXCLUDED.section_role, grace_seconds = EXCLUDED.grace_seconds,
  allow_back_nav = EXCLUDED.allow_back_nav;`)

  s.push(`
INSERT INTO assessment_sections (id, assessment_id, response_format_id, title, instructions,
                                 display_order, item_ordering, time_limit_seconds, section_role,
                                 grace_seconds, allow_back_nav)
VALUES (${lit(IDS.scoredSection)}::uuid, ${lit(IDS.assessment)}::uuid, ${lit(responseFormatId)}::uuid,
        'Figural Matrices',
        'Choose the option that completes the pattern. You have ${SCORED_TIME_LIMIT_SECONDS / 60} minutes for all ${scoredOrder.length} questions. You can go back and change an answer at any time before the section ends. Work carefully — accuracy matters more than speed.',
        1, 'fixed', ${SCORED_TIME_LIMIT_SECONDS}, 'scored', 20, true)
ON CONFLICT (id) DO UPDATE SET assessment_id = EXCLUDED.assessment_id,
  response_format_id = EXCLUDED.response_format_id, title = EXCLUDED.title,
  instructions = EXCLUDED.instructions, display_order = EXCLUDED.display_order,
  item_ordering = EXCLUDED.item_ordering, time_limit_seconds = EXCLUDED.time_limit_seconds,
  section_role = EXCLUDED.section_role, grace_seconds = EXCLUDED.grace_seconds,
  allow_back_nav = EXCLUDED.allow_back_nav;`)

  // --- practice promotion -------------------------------------------------
  if (plan.toPromote.length > 0) {
    s.push(
      `UPDATE items SET purpose = 'practice'
        WHERE id = ANY(${uuidArray(plan.toPromote.map((i) => i.itemId))}) AND purpose <> 'practice';`,
    )
  }

  // --- item links ---------------------------------------------------------
  // Delete-then-upsert scoped to each section, so a re-run after the bank grew
  // converges on the recomputed form instead of accumulating stale links.
  const linkValues = (sectionId: string, items: BankItem[]) =>
    items
      .map((item, index) => `(${lit(sectionId)}::uuid, ${lit(item.itemId)}::uuid, ${index})`)
      .join(',\n         ')

  for (const [sectionId, items] of [
    [IDS.practiceSection, plan.practice],
    [IDS.scoredSection, scoredOrder],
  ] as const) {
    if (items.length === 0) continue
    s.push(`
DELETE FROM assessment_section_items
 WHERE section_id = ${lit(sectionId)}::uuid
   AND NOT (item_id = ANY(${uuidArray(items.map((i) => i.itemId))}));

INSERT INTO assessment_section_items (section_id, item_id, display_order)
VALUES ${linkValues(sectionId, items)}
ON CONFLICT (section_id, item_id) DO UPDATE SET display_order = EXCLUDED.display_order;`)
  }

  return s.join('\n')
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function snapshot(): Record<string, number> {
  const one = (text: string) => Number(sql(text))
  return {
    assessments: one(`SELECT count(*) FROM assessments WHERE id = ${lit(IDS.assessment)}::uuid`),
    sections: one(`SELECT count(*) FROM assessment_sections WHERE assessment_id = ${lit(IDS.assessment)}::uuid`),
    practice_section_items: one(
      `SELECT count(*) FROM assessment_section_items WHERE section_id = ${lit(IDS.practiceSection)}::uuid`,
    ),
    scored_section_items: one(
      `SELECT count(*) FROM assessment_section_items WHERE section_id = ${lit(IDS.scoredSection)}::uuid`,
    ),
    assessment_factors: one(
      `SELECT count(*) FROM assessment_factors WHERE assessment_id = ${lit(IDS.assessment)}::uuid`,
    ),
    factor_constructs: one(`SELECT count(*) FROM factor_constructs WHERE factor_id = ${lit(IDS.factor)}::uuid`),
    practice_purpose_items: one(`SELECT count(*) FROM items WHERE purpose = 'practice' AND deleted_at IS NULL`),
  }
}

function main(): void {
  const constructId = resolveConstructId()
  const bank = loadBank(constructId)
  if (bank.length === 0) {
    // Distinguish "no bank" from "a bank nobody has reviewed yet" — they look
    // identical from an empty result and lead to completely different actions.
    const drafts = sql(`
      SELECT count(*) FROM items i JOIN item_families f ON f.id = i.family_id
       WHERE f.kind = 'figural_matrix' AND i.construct_id = ${lit(constructId)}::uuid
         AND i.deleted_at IS NULL
         AND i.lifecycle_state NOT IN ('piloting','calibrated','operational','retired','killed')
    `)
    if (Number(drafts) > 0) {
      fail(
        `construct ${constructId} has ${drafts} figural-matrix items, but none has been ` +
          'reviewed. Record content and fairness sign-offs in the item bank review queue ' +
          '(/item-bank/review), move the approved items to "piloting", then re-run. ' +
          'Nothing composes an assessment out of unreviewed items.',
      )
    }
    fail(
      `construct ${constructId} has no deliverable figural-matrix items ` +
        '(each needs a cognitive_item_specs row AND an item_answer_keys row).',
    )
  }

  const responseFormatIds = new Set(bank.map((i) => i.responseFormatId))
  if (responseFormatIds.size > 1) {
    fail(
      `the bank uses ${responseFormatIds.size} different response formats; a section carries exactly one. ` +
        'Split the bank or fix the ingest.',
    )
  }
  const responseFormatId = bank[0].responseFormatId
  const formatType = sql(`SELECT type FROM response_formats WHERE id = ${lit(responseFormatId)}::uuid`)
  if (formatType !== 'cognitive') {
    fail(
      `response format ${responseFormatId} is type '${formatType}', not 'cognitive' — the runner would not ` +
        'render these items as matrices (src/app/actions/assess.ts).',
    )
  }

  const alreadyPractice = new Set(
    rows(
      `SELECT item_id FROM assessment_section_items WHERE section_id = ${lit(IDS.practiceSection)}::uuid`,
    ).map((r) => r[0]),
  )

  const plan = planForm(bank, alreadyPractice)
  const { order: scoredOrder, violations } = breakKeyRuns(plan.scored)

  // Safety: never silently rewrite a form somebody has already been served.
  const sectionIds = uuidArray([IDS.practiceSection, IDS.scoredSection])
  const frozenForms = Number(
    sql(`SELECT count(*) FROM participant_section_forms WHERE section_id = ANY(${sectionIds})`),
  )
  const currentLinks = new Set(
    rows(`SELECT section_id || '|' || item_id || '|' || display_order
            FROM assessment_section_items WHERE section_id = ANY(${sectionIds})`).map((r) => r.join('|')),
  )
  const plannedLinks = new Set([
    ...plan.practice.map((i, n) => `${IDS.practiceSection}|${i.itemId}|${n}`),
    ...scoredOrder.map((i, n) => `${IDS.scoredSection}|${i.itemId}|${n}`),
  ])
  const linksIdentical =
    currentLinks.size === plannedLinks.size && [...plannedLinks].every((k) => currentLinks.has(k))

  if (frozenForms > 0 && !linksIdentical && !FORCE) {
    fail(
      `${frozenForms} participant(s) have already been served a frozen form for these sections and the plan ` +
        'differs from what is stored. Rewriting the form now would make delivered and configured content ' +
        'disagree. Re-run with --force only if you understand that.',
    )
  }

  // ---- report -------------------------------------------------------------
  console.log('LR-M assessment composition')
  console.log(`  construct          ${constructId}`)
  console.log(`  response format    ${responseFormatId} (${formatType})`)
  console.log(`  bank available     ${bank.length} deliverable items across ${new Set(bank.map((i) => i.familyCode)).size} families`)
  console.log(`  bank by band       ${JSON.stringify(histogram(bank.map((i) => i.band)))}`)
  console.log(`  lifecycle states   ${JSON.stringify(histogram(bank.map((i) => i.lifecycleState)))}`)
  console.log('')
  console.log(`  practice section   ${plan.practice.length} item(s), untimed, section_role='practice'`)
  for (const [n, item] of plan.practice.entries()) {
    console.log(`      ${n}  ${item.familyCode.padEnd(20)} b=${bStr(item.predictedB)}  key=${item.keySlot}  ${item.itemId}`)
  }
  console.log(`  scored section     ${scoredOrder.length} item(s), ${SCORED_TIME_LIMIT_SECONDS}s, section_role='scored'`)
  for (const [n, item] of scoredOrder.entries()) {
    console.log(`      ${String(n).padStart(2)}  ${item.familyCode.padEnd(20)} b=${bStr(item.predictedB)}  key=${item.keySlot}  ${item.itemId}`)
  }
  console.log('')
  console.log(`  scored by band     ${JSON.stringify(histogram(scoredOrder.map((i) => i.band)))} (blueprint ${JSON.stringify(SCORED_BLUEPRINT)})`)
  console.log(`  key positions      ${JSON.stringify(histogram(scoredOrder.map((i) => i.keySlot)))}`)

  const keyCounts = Object.values(histogram(scoredOrder.map((i) => i.keySlot)))
  const balanced = keyCounts.length > 0 && Math.max(...keyCounts) - Math.min(...keyCounts) <= 1 && keyCounts.length === 5
  console.log(`  §9.2 key balance   ${balanced ? 'OK (all five positions within +/-1)' : 'NOT MET — the bank is too thin to balance A-E'}`)
  console.log(`  §9.2 no 3-in-a-row ${violations === 0 ? 'OK' : `NOT MET — ${violations} run(s) of 3+ remain`}`)

  if (plan.toPromote.length > 0) {
    console.log('')
    console.log(`  PROMOTING ${plan.toPromote.length} item(s) to items.purpose='practice' (one-way — their keys get revealed):`)
    for (const item of plan.toPromote) console.log(`      ${item.itemId}  ${item.familyCode}`)
  }
  for (const shortfall of plan.shortfalls) console.log(`  SHORTFALL          ${shortfall}`)

  const draftish = bank.filter((i) => i.lifecycleState === 'draft').length
  if (draftish > 0) {
    console.log('')
    console.log(
      `  NOTE: ${draftish}/${bank.length} bank items are lifecycle_state='draft' — no content or fairness ` +
        'sign-off recorded. This form is a PILOT form. Nothing here walks the lifecycle; that needs real reviews.',
    )
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: nothing written.')
    return
  }

  const before = snapshot()
  execScript(buildScript(plan, scoredOrder, responseFormatId, constructId))
  const after = snapshot()

  console.log('')
  console.log('BEFORE ', JSON.stringify(before))
  console.log('AFTER  ', JSON.stringify(after))
  console.log(`changed: ${JSON.stringify(before) !== JSON.stringify(after)}`)

  // ---- verify what actually landed ---------------------------------------
  const verified = rows(`
    SELECT a.scoring_profile::text, a.status::text, a.slug,
           (SELECT count(*) FROM assessment_sections s WHERE s.assessment_id = a.id),
           (SELECT count(*) FROM assessment_factors af WHERE af.assessment_id = a.id)
      FROM assessments a WHERE a.id = ${lit(IDS.assessment)}::uuid
  `)[0]
  const sectionRows = rows(`
    SELECT s.section_role::text, s.display_order::text, coalesce(s.time_limit_seconds::text,'null'),
           s.item_ordering::text, s.allow_back_nav::text,
           (SELECT count(*) FROM assessment_section_items i WHERE i.section_id = s.id),
           (SELECT count(*) FROM assessment_section_items i JOIN items it ON it.id = i.item_id
             WHERE i.section_id = s.id AND it.purpose = 'practice')
      FROM assessment_sections s WHERE s.assessment_id = ${lit(IDS.assessment)}::uuid
     ORDER BY s.display_order
  `)

  console.log('')
  console.log(`  assessment         slug=${verified[2]} status=${verified[1]} scoring_profile=${verified[0]}`)
  console.log(`                     sections=${verified[3]} assessment_factors=${verified[4]}`)
  for (const [role, order, limit, ordering, backNav, itemCount, practiceItems] of sectionRows) {
    console.log(
      `  section ${order}          role=${role} time_limit=${limit} ordering=${ordering} ` +
        `back_nav=${backNav} items=${itemCount} (purpose='practice': ${practiceItems})`,
    )
  }

  const ok =
    verified[0] === 'ability_dichotomous' &&
    Number(verified[3]) === 2 &&
    Number(verified[4]) === 1 &&
    sectionRows.some((r) => r[0] === 'practice' && r[2] === 'null' && Number(r[5]) === plan.practice.length) &&
    sectionRows.some(
      (r) => r[0] === 'scored' && Number(r[2]) === SCORED_TIME_LIMIT_SECONDS && Number(r[5]) === scoredOrder.length,
    )

  console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`)
  if (!ok) process.exitCode = 1
}

main()
