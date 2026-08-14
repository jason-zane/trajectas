import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { logActionError } from '@/lib/security/action-errors'
import type { DifficultyPriorBand } from '@/lib/item-bank/bank-file'

/**
 * Admin-side reads over the cognitive item bank (LR-8 / #347 scope items 4
 * and 5). The counterpart to `src/lib/dal/cognitive-items.ts`, which serves
 * the participant runner.
 *
 * The division of labour between the two is deliberate and load-bearing:
 *
 *   - `cognitive-items.ts` renders specs for delivery and NEVER names key
 *     material.
 *   - THIS module reports on the bank — counts, distributions, provenance —
 *     and also never names key material. Nothing here needs it.
 *   - `item-bank-review.ts` is the ONLY module that reads
 *     `item_answer_keys` / `item_option_diagnostics` for an admin, and it
 *     exists separately precisely so the boundary is one file wide and
 *     testable (tests/architecture/admin-answer-key-isolation.test.ts).
 *
 * Every function takes a service-role client: `item_families`,
 * `cognitive_item_specs` and `cognitive_generation_runs` are service-role-only
 * by grant (20260813100500), so an RLS-scoped client gets "permission denied"
 * rather than an empty list. Authorization is the caller's job — see
 * `src/app/actions/item-bank.ts`, where every export is behind
 * `requireAdminScope()`.
 *
 * ---------------------------------------------------------------------------
 * DIFFICULTY IS A DESIGN PRIOR
 * ---------------------------------------------------------------------------
 * Every difficulty number this module returns is named `difficultyPrior*`, not
 * `difficulty`. It is the output of the rule-based radical model: out-of-sample
 * R² ~0.43, with ~28% of the variance sitting BETWEEN clones that are
 * identical on every modelled radical. It is what the design predicts before
 * anyone has answered the item, and it must never be presented, aggregated or
 * reasoned about as a measured value. Calibrated difficulty lives in
 * `item_parameters` and only exists after piloting.
 */

type DbClient = SupabaseClient

export const ITEM_LIFECYCLE_STATES = [
  'draft',
  'content_reviewed',
  'fairness_reviewed',
  'piloting',
  'calibrated',
  'operational',
  'suspended',
  'retired',
  'killed',
] as const
export type ItemLifecycleState = (typeof ITEM_LIFECYCLE_STATES)[number]

export const DIFFICULTY_PRIOR_BANDS = ['easy', 'moderate', 'hard', 'very_hard'] as const

export type LifecycleCounts = Record<ItemLifecycleState, number>
export type DifficultyPriorBandCounts = Record<DifficultyPriorBand, number>

export type SignOffSummary = {
  decision: 'approved' | 'rejected'
  reviewerProfileId: string
  reviewerName: string | null
  reviewerEmail: string | null
  reviewedAt: string
  /** The item content the reviewer actually saw, stamped by trigger at insert. */
  reviewedContentHash: string | null
  /** False when the item's content changed after this sign-off — it no longer counts. */
  matchesCurrentContent: boolean
  notes: string | null
}

export type ItemFamilyOverview = {
  id: string
  code: string
  kind: string
  constructId: string
  constructName: string | null
  /** Rule ids the family asserts, e.g. ['R6','R2']. */
  ruleIds: string[]
  /** The family's radical profile — the inputs to the difficulty prior. */
  radicals: Record<string, unknown> | null
  /** DESIGN PRIOR (see module header), family-level. Never a measured value. */
  difficultyPriorB: number | null
  difficultyPriorBand: DifficultyPriorBand | null
  exemplarItemId: string | null
  notes: string | null
  itemCount: number
  lifecycleCounts: LifecycleCounts
  /** Distribution of the members' own DESIGN PRIOR bands. */
  difficultyPriorBandCounts: DifficultyPriorBandCounts
  totalExposureCount: number
  createdAt: string
}

export type ItemBankOverview = {
  familyCount: number
  itemCount: number
  lifecycleCounts: LifecycleCounts
  difficultyPriorBandCounts: DifficultyPriorBandCounts
  totalExposureCount: number
  generationRunCount: number
  latestGenerationRunAt: string | null
}

export type FormPlacement = {
  assessmentId: string
  assessmentTitle: string
  assessmentStatus: string
  sectionId: string
  sectionTitle: string
  /** 'scored' | 'practice' | 'instructions'. */
  sectionRole: string
  displayOrder: number
}

export type BankItemSummary = {
  id: string
  stem: string
  familyId: string | null
  lifecycleState: ItemLifecycleState
  status: string
  itemVersion: number
  parentItemId: string | null
  contentHash: string | null
  exposureCount: number
  retiredAt: string | null
  createdAt: string
  /** DESIGN PRIOR — see module header. */
  difficultyPriorB: number | null
  difficultyPriorBand: DifficultyPriorBand | null
  generatorSeed: string | null
  generationRunId: string | null
  contentSignOff: SignOffSummary | null
  fairnessSignOff: SignOffSummary | null
  formPlacements: FormPlacement[]
}

export type GenerationRunSummary = {
  id: string
  kind: string
  generatorName: string
  generatorVersion: string
  gitSha: string | null
  seed: string
  params: Record<string, unknown>
  status: string
  itemsProposed: number
  itemsAccepted: number
  itemsRejected: number
  /** Per-gate pass/fail/skip tallies over the accepted items. */
  qaGateTallies: Record<string, { pass: number; fail: number; skip: number }>
  /** Generator reject reasons (gate id -> count) summed across families. */
  rejectionReasons: Record<string, number>
  /** DESIGN PRIOR bands — see module header. */
  difficultyPriorBandDistribution: Record<string, number>
  perFamily: Record<string, { attempted: number; accepted: number; rejects: Record<string, number> }>
  requestedByProfileId: string | null
  requestedByName: string | null
  startedAt: string
  completedAt: string | null
  errorMessage: string | null
  /** How many `cognitive_item_specs` rows point at this run. */
  ingestedItemCount: number
}

export type GenerationRunDetail = GenerationRunSummary & {
  items: BankItemSummary[]
}

function emptyLifecycleCounts(): LifecycleCounts {
  return Object.fromEntries(ITEM_LIFECYCLE_STATES.map((s) => [s, 0])) as LifecycleCounts
}

function emptyBandCounts(): DifficultyPriorBandCounts {
  return Object.fromEntries(DIFFICULTY_PRIOR_BANDS.map((b) => [b, 0])) as DifficultyPriorBandCounts
}

function asBand(value: unknown): DifficultyPriorBand | null {
  return typeof value === 'string' && (DIFFICULTY_PRIOR_BANDS as readonly string[]).includes(value)
    ? (value as DifficultyPriorBand)
    : null
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function asLifecycle(value: unknown): ItemLifecycleState {
  return (ITEM_LIFECYCLE_STATES as readonly string[]).includes(value as string)
    ? (value as ItemLifecycleState)
    : 'draft'
}

type ItemRow = {
  id: string
  stem: string
  family_id: string | null
  lifecycle_state: string
  status: string
  item_version: number
  parent_item_id: string | null
  content_hash: string | null
  exposure_count: number
  retired_at: string | null
  created_at: string
}

const ITEM_COLUMNS =
  'id, stem, family_id, lifecycle_state, status, item_version, parent_item_id, content_hash, exposure_count, retired_at, created_at'

/**
 * Per-item design prior + provenance, read straight out of the stored QA
 * report via PostgREST's JSON accessors so the (large) full `qa` blob never
 * crosses the wire for a list view.
 */
type SpecMetaRow = {
  item_id: string
  generator_seed: string | null
  generation_run_id: string | null
  prior_band: string | null
  prior_b: string | null
}

const SPEC_META_COLUMNS =
  'item_id, generator_seed, generation_run_id, prior_band:qa->>band, prior_b:qa->>predictedB'

async function loadSpecMeta(db: DbClient, itemIds: string[]): Promise<Map<string, SpecMetaRow>> {
  const out = new Map<string, SpecMetaRow>()
  if (itemIds.length === 0) return out
  const { data, error } = await db.from('cognitive_item_specs').select(SPEC_META_COLUMNS).in('item_id', itemIds)
  if (error) {
    logActionError('itemBankAdmin.specMeta', error)
    return out
  }
  for (const row of (data ?? []) as unknown as SpecMetaRow[]) out.set(row.item_id, row)
  return out
}

/**
 * Standing sign-offs (the newest row per item+kind) plus reviewer identity.
 * `matchesCurrentContent` is what turns a historical record into a live
 * permission: the DB guard applies exactly the same test before allowing a
 * promotion, so a `false` here is the UI's warning that the item needs
 * re-reviewing.
 */
export async function loadStandingSignOffs(
  db: DbClient,
  items: ReadonlyArray<{ id: string; contentHash: string | null }>,
): Promise<Map<string, { content: SignOffSummary | null; fairness: SignOffSummary | null }>> {
  const result = new Map<string, { content: SignOffSummary | null; fairness: SignOffSummary | null }>()
  for (const item of items) result.set(item.id, { content: null, fairness: null })
  if (items.length === 0) return result

  const { data, error } = await db
    .from('item_reviews')
    .select(
      'item_id, review_kind, decision, reviewer_profile_id, reviewed_content_hash, notes, created_at, profiles:reviewer_profile_id(first_name, last_name, email)',
    )
    .in(
      'item_id',
      items.map((i) => i.id),
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (error) {
    logActionError('itemBankAdmin.standingSignOffs', error)
    return result
  }

  const hashById = new Map(items.map((i) => [i.id, i.contentHash]))
  type Row = {
    item_id: string
    review_kind: 'content' | 'fairness'
    decision: 'approved' | 'rejected'
    reviewer_profile_id: string
    reviewed_content_hash: string | null
    notes: string | null
    created_at: string
    profiles: { first_name: string | null; last_name: string | null; email: string | null } | null
  }

  // Rows arrive newest-first, so the FIRST row seen for an (item, kind) pair
  // is the standing decision. Later (older) rows are history.
  for (const row of (data ?? []) as unknown as Row[]) {
    const entry = result.get(row.item_id)
    if (!entry || entry[row.review_kind]) continue
    const currentHash = hashById.get(row.item_id) ?? null
    entry[row.review_kind] = {
      decision: row.decision,
      reviewerProfileId: row.reviewer_profile_id,
      reviewerName: formatName(row.profiles),
      reviewerEmail: row.profiles?.email ?? null,
      reviewedAt: row.created_at,
      reviewedContentHash: row.reviewed_content_hash,
      matchesCurrentContent: currentHash === null || row.reviewed_content_hash === currentHash,
      notes: row.notes,
    }
  }

  return result
}

function formatName(profile: { first_name: string | null; last_name: string | null } | null): string | null {
  if (!profile) return null
  const name = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
  return name.length > 0 ? name : null
}

/**
 * Which operational forms an item sits in. A "form" here is an
 * `assessment_sections` row: that is the unit an item is placed into and the
 * unit a participant's frozen `participant_section_forms` snapshot is taken
 * from. Returned keyed by item id so a list view can annotate every row from
 * one query.
 */
export async function listItemFormPlacements(
  db: DbClient,
  itemIds: readonly string[],
): Promise<Map<string, FormPlacement[]>> {
  const result = new Map<string, FormPlacement[]>()
  if (itemIds.length === 0) return result

  const { data, error } = await db
    .from('assessment_section_items')
    .select(
      'item_id, display_order, assessment_sections!inner(id, title, section_role, assessments!inner(id, title, status, deleted_at))',
    )
    .in('item_id', itemIds as string[])

  if (error) {
    logActionError('itemBankAdmin.formPlacements', error)
    return result
  }

  type Row = {
    item_id: string
    display_order: number
    assessment_sections: {
      id: string
      title: string
      section_role: string
      assessments: { id: string; title: string; status: string; deleted_at: string | null } | null
    } | null
  }

  for (const row of (data ?? []) as unknown as Row[]) {
    const section = row.assessment_sections
    const assessment = section?.assessments
    if (!section || !assessment || assessment.deleted_at) continue
    const list = result.get(row.item_id) ?? []
    list.push({
      assessmentId: assessment.id,
      assessmentTitle: assessment.title,
      assessmentStatus: assessment.status,
      sectionId: section.id,
      sectionTitle: section.title,
      sectionRole: section.section_role,
      displayOrder: row.display_order,
    })
    result.set(row.item_id, list)
  }

  return result
}

/**
 * #347 scope item 4: "families with their radicals and predicted difficulty,
 * band distribution, item counts by lifecycle state, exposure counts".
 */
export async function listItemFamilies(db: DbClient): Promise<ItemFamilyOverview[]> {
  const { data: familyRows, error: familyError } = await db
    .from('item_families')
    .select(
      'id, code, kind, construct_id, rules, radicals, predicted_b, band, exemplar_item_id, notes, created_at, constructs(name)',
    )
    .order('code', { ascending: true })

  if (familyError) {
    logActionError('itemBankAdmin.listItemFamilies', familyError)
    return []
  }

  type FamilyRow = {
    id: string
    code: string
    kind: string
    construct_id: string
    rules: unknown
    radicals: unknown
    predicted_b: number | string | null
    band: string | null
    exemplar_item_id: string | null
    notes: string | null
    created_at: string
    constructs: { name: string } | null
  }

  const families = (familyRows ?? []) as unknown as FamilyRow[]
  if (families.length === 0) return []

  const familyIds = families.map((f) => f.id)
  const { data: itemRows, error: itemError } = await db
    .from('items')
    .select('id, family_id, lifecycle_state, exposure_count')
    .in('family_id', familyIds)
    .is('deleted_at', null)

  if (itemError) {
    logActionError('itemBankAdmin.listItemFamilies.items', itemError)
    return []
  }

  const items = (itemRows ?? []) as Array<{
    id: string
    family_id: string | null
    lifecycle_state: string
    exposure_count: number
  }>
  const specMeta = await loadSpecMeta(
    db,
    items.map((i) => i.id),
  )

  const byFamily = new Map<
    string,
    { count: number; lifecycle: LifecycleCounts; bands: DifficultyPriorBandCounts; exposure: number }
  >()
  for (const family of families) {
    byFamily.set(family.id, {
      count: 0,
      lifecycle: emptyLifecycleCounts(),
      bands: emptyBandCounts(),
      exposure: 0,
    })
  }
  for (const item of items) {
    if (!item.family_id) continue
    const agg = byFamily.get(item.family_id)
    if (!agg) continue
    agg.count += 1
    agg.lifecycle[asLifecycle(item.lifecycle_state)] += 1
    agg.exposure += item.exposure_count ?? 0
    const band = asBand(specMeta.get(item.id)?.prior_band)
    if (band) agg.bands[band] += 1
  }

  return families.map((family) => {
    const agg = byFamily.get(family.id)!
    return {
      id: family.id,
      code: family.code,
      kind: family.kind,
      constructId: family.construct_id,
      constructName: family.constructs?.name ?? null,
      ruleIds: Array.isArray(family.rules) ? (family.rules as unknown[]).map(String) : [],
      radicals:
        family.radicals && typeof family.radicals === 'object'
          ? (family.radicals as Record<string, unknown>)
          : null,
      difficultyPriorB: asNumber(family.predicted_b),
      difficultyPriorBand: asBand(family.band),
      exemplarItemId: family.exemplar_item_id,
      notes: family.notes,
      itemCount: agg.count,
      lifecycleCounts: agg.lifecycle,
      difficultyPriorBandCounts: agg.bands,
      totalExposureCount: agg.exposure,
      createdAt: family.created_at,
    }
  })
}

/** Bank-wide totals for the landing screen. */
export async function getItemBankOverview(db: DbClient): Promise<ItemBankOverview> {
  const empty: ItemBankOverview = {
    familyCount: 0,
    itemCount: 0,
    lifecycleCounts: emptyLifecycleCounts(),
    difficultyPriorBandCounts: emptyBandCounts(),
    totalExposureCount: 0,
    generationRunCount: 0,
    latestGenerationRunAt: null,
  }

  const [familyResult, itemResult, runResult] = await Promise.all([
    db.from('item_families').select('id'),
    db
      .from('items')
      .select('id, lifecycle_state, exposure_count')
      .not('family_id', 'is', null)
      .is('deleted_at', null),
    db.from('cognitive_generation_runs').select('id, started_at').order('started_at', { ascending: false }),
  ])

  if (familyResult.error || itemResult.error || runResult.error) {
    logActionError(
      'itemBankAdmin.overview',
      familyResult.error ?? itemResult.error ?? runResult.error,
    )
    return empty
  }

  const items = (itemResult.data ?? []) as Array<{
    id: string
    lifecycle_state: string
    exposure_count: number
  }>
  const specMeta = await loadSpecMeta(
    db,
    items.map((i) => i.id),
  )

  const lifecycleCounts = emptyLifecycleCounts()
  const bandCounts = emptyBandCounts()
  let exposure = 0
  for (const item of items) {
    lifecycleCounts[asLifecycle(item.lifecycle_state)] += 1
    exposure += item.exposure_count ?? 0
    const band = asBand(specMeta.get(item.id)?.prior_band)
    if (band) bandCounts[band] += 1
  }

  const runs = (runResult.data ?? []) as Array<{ id: string; started_at: string }>
  return {
    familyCount: (familyResult.data ?? []).length,
    itemCount: items.length,
    lifecycleCounts,
    difficultyPriorBandCounts: bandCounts,
    totalExposureCount: exposure,
    generationRunCount: runs.length,
    latestGenerationRunAt: runs[0]?.started_at ?? null,
  }
}

async function summariseItems(db: DbClient, rows: ItemRow[]): Promise<BankItemSummary[]> {
  if (rows.length === 0) return []
  const itemIds = rows.map((r) => r.id)
  const [specMeta, signOffs, placements] = await Promise.all([
    loadSpecMeta(db, itemIds),
    loadStandingSignOffs(
      db,
      rows.map((r) => ({ id: r.id, contentHash: r.content_hash })),
    ),
    listItemFormPlacements(db, itemIds),
  ])

  return rows.map((row) => {
    const meta = specMeta.get(row.id)
    const signOff = signOffs.get(row.id)
    return {
      id: row.id,
      stem: row.stem,
      familyId: row.family_id,
      lifecycleState: asLifecycle(row.lifecycle_state),
      status: row.status,
      itemVersion: row.item_version,
      parentItemId: row.parent_item_id,
      contentHash: row.content_hash,
      exposureCount: row.exposure_count ?? 0,
      retiredAt: row.retired_at,
      createdAt: row.created_at,
      difficultyPriorB: asNumber(meta?.prior_b),
      difficultyPriorBand: asBand(meta?.prior_band),
      generatorSeed: meta?.generator_seed ?? null,
      generationRunId: meta?.generation_run_id ?? null,
      contentSignOff: signOff?.content ?? null,
      fairnessSignOff: signOff?.fairness ?? null,
      formPlacements: placements.get(row.id) ?? [],
    }
  })
}

/** Every live item in a family, with its lifecycle, prior, sign-offs and form placements. */
export async function listFamilyItems(db: DbClient, familyId: string): Promise<BankItemSummary[]> {
  const { data, error } = await db
    .from('items')
    .select(ITEM_COLUMNS)
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })

  if (error) {
    logActionError('itemBankAdmin.listFamilyItems', error)
    return []
  }
  return summariseItems(db, (data ?? []) as unknown as ItemRow[])
}

/** Items in a given lifecycle state across the whole bank — the review queue. */
export async function listItemsByLifecycleState(
  db: DbClient,
  state: ItemLifecycleState,
  limit = 200,
): Promise<BankItemSummary[]> {
  const { data, error } = await db
    .from('items')
    .select(ITEM_COLUMNS)
    .eq('lifecycle_state', state)
    .not('family_id', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    logActionError('itemBankAdmin.listItemsByLifecycleState', error)
    return []
  }
  return summariseItems(db, (data ?? []) as unknown as ItemRow[])
}

type RunRow = {
  id: string
  kind: string
  generator_name: string
  generator_version: string
  git_sha: string | null
  seed: string
  params: unknown
  status: string
  items_proposed: number
  items_accepted: number
  items_rejected: number
  qa_summary: unknown
  error_message: string | null
  requested_by: string | null
  started_at: string
  completed_at: string | null
  profiles: { first_name: string | null; last_name: string | null } | null
}

const RUN_COLUMNS =
  'id, kind, generator_name, generator_version, git_sha, seed, params, status, items_proposed, items_accepted, items_rejected, qa_summary, error_message, requested_by, started_at, completed_at, profiles:requested_by(first_name, last_name)'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function mapRun(row: RunRow, ingestedItemCount: number): GenerationRunSummary {
  const qaSummary = record(row.qa_summary)
  return {
    id: row.id,
    kind: row.kind,
    generatorName: row.generator_name,
    generatorVersion: row.generator_version,
    gitSha: row.git_sha,
    seed: row.seed,
    params: record(row.params),
    status: row.status,
    itemsProposed: row.items_proposed,
    itemsAccepted: row.items_accepted,
    itemsRejected: row.items_rejected,
    qaGateTallies: record(qaSummary.gates) as GenerationRunSummary['qaGateTallies'],
    rejectionReasons: record(qaSummary.rejectionReasons) as Record<string, number>,
    difficultyPriorBandDistribution: record(
      qaSummary.difficultyPriorBandDistribution,
    ) as Record<string, number>,
    perFamily: record(qaSummary.perFamily) as GenerationRunSummary['perFamily'],
    requestedByProfileId: row.requested_by,
    requestedByName: formatName(row.profiles),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
    ingestedItemCount,
  }
}

/**
 * #347 scope item 5: a run traceable to the parameters that produced it —
 * seed, generator version, QA pass/fail tallies and rejection reasons.
 */
export async function listGenerationRuns(db: DbClient, limit = 50): Promise<GenerationRunSummary[]> {
  const { data, error } = await db
    .from('cognitive_generation_runs')
    .select(RUN_COLUMNS)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    logActionError('itemBankAdmin.listGenerationRuns', error)
    return []
  }

  const rows = (data ?? []) as unknown as RunRow[]
  if (rows.length === 0) return []

  const { data: specRows, error: specError } = await db
    .from('cognitive_item_specs')
    .select('generation_run_id')
    .in(
      'generation_run_id',
      rows.map((r) => r.id),
    )
  if (specError) logActionError('itemBankAdmin.listGenerationRuns.specs', specError)

  const counts = new Map<string, number>()
  for (const row of (specRows ?? []) as Array<{ generation_run_id: string | null }>) {
    if (!row.generation_run_id) continue
    counts.set(row.generation_run_id, (counts.get(row.generation_run_id) ?? 0) + 1)
  }

  return rows.map((row) => mapRun(row, counts.get(row.id) ?? 0))
}

/** One run plus the items it put in the bank. */
export async function getGenerationRun(db: DbClient, runId: string): Promise<GenerationRunDetail | null> {
  const { data, error } = await db.from('cognitive_generation_runs').select(RUN_COLUMNS).eq('id', runId).maybeSingle()
  if (error) {
    logActionError('itemBankAdmin.getGenerationRun', error)
    return null
  }
  if (!data) return null

  const { data: specRows, error: specError } = await db
    .from('cognitive_item_specs')
    .select('item_id')
    .eq('generation_run_id', runId)
  if (specError) logActionError('itemBankAdmin.getGenerationRun.specs', specError)

  const itemIds = ((specRows ?? []) as Array<{ item_id: string }>).map((r) => r.item_id)
  let items: BankItemSummary[] = []
  if (itemIds.length > 0) {
    const { data: itemRows, error: itemError } = await db
      .from('items')
      .select(ITEM_COLUMNS)
      .in('id', itemIds)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
    if (itemError) logActionError('itemBankAdmin.getGenerationRun.items', itemError)
    items = await summariseItems(db, (itemRows ?? []) as unknown as ItemRow[])
  }

  return { ...mapRun(data as unknown as RunRow, itemIds.length), items }
}

/**
 * The legal lifecycle transitions out of every state, read from the database
 * function that the enforcing trigger itself consults
 * (`item_lifecycle_legal_transitions()`, migration 20260814110000). The UI
 * uses this to decide which transitions to OFFER; the trigger remains the
 * only thing that decides which are ALLOWED. There is deliberately no copy of
 * the state machine in TypeScript.
 */
export async function getLifecycleTransitionGraph(
  db: DbClient,
): Promise<Map<ItemLifecycleState, ItemLifecycleState[]>> {
  const graph = new Map<ItemLifecycleState, ItemLifecycleState[]>()
  const { data, error } = await db.rpc('item_lifecycle_legal_transitions')
  if (error) {
    logActionError('itemBankAdmin.lifecycleTransitionGraph', error)
    return graph
  }
  for (const row of (data ?? []) as Array<{ from_state: string; to_state: string }>) {
    const from = asLifecycle(row.from_state)
    const list = graph.get(from) ?? []
    list.push(asLifecycle(row.to_state))
    graph.set(from, list)
  }
  return graph
}
