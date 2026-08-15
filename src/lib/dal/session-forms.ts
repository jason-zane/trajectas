import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { logActionError } from '@/lib/security/action-errors'
import { selectItemsByDifficulty } from '@/lib/item-selection/distribution'
import { applyItemOrdering } from '@/lib/item-ordering'
import type { ItemOrdering } from '@/types/database'

type DbClient = SupabaseClient

const ASSEMBLER_VERSION = 'form-assembler@1'
const ERROR_MESSAGE = 'Unable to load this assessment right now'

/**
 * Frozen per-session form snapshots (LR-3 / #333) — see the migration
 * (20260813103000_frozen_session_forms.sql) for the full design rationale,
 * including why the freeze lives here (a DAL upsert) rather than inside the
 * start_section_for_session RPC, and how in-flight-at-deploy sessions are
 * handled without risking a part-finished session.
 *
 * This module is the ONLY place that assembles a section's delivered item
 * set — the campaign factor filter, selectItemsByDifficulty, and
 * applyItemOrdering pipeline that used to be duplicated (by hand) between
 * getSessionState and session-completeness.ts. Both now call
 * getOrCreateSectionForms; there is exactly one implementation of "what was
 * delivered", so the two can no longer desync.
 */

export type SectionFormEntryDTO = {
  position: number
  itemId: string
  itemVersion: number
  contentHash: string | null
  /** items.purpose at assembly time ('construct' | 'practice' | 'seed' | ...). */
  purpose: string
  /** False for practice/seed items — they are delivered (and required by the
   *  completeness gate) but never enter a scoring aggregate. */
  countsTowardScore: boolean
}

export type SectionFormDTO = {
  sessionId: string
  sectionId: string
  assembledAt: string
  assemblySeed: string
  assemblerVersion: string
  formCode: string | null
  entries: SectionFormEntryDTO[]
}

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

type FormItemEmbed = {
  id: string
  construct_id: string | null
  purpose: string | null
  difficulty: 'easy' | 'medium' | 'hard' | null
  reverse_scored: boolean | null
  item_version: number | null
  content_hash: string | null
  lifecycle_state: string | null
} | null

/**
 * Lifecycle states that mean "stop serving this", whatever a form still says.
 *
 * Assembly is the last point at which an item can be kept out of a session, and
 * until now it filtered on nothing at all — not lifecycle, not deleted_at, not
 * status. An item withdrawn after it was placed in an assessment kept being
 * handed to new respondents, because the link is what delivery reads and
 * withdrawing an item does not remove the link.
 *
 * Stated as a DENY list rather than an allow list on purpose. Every item in the
 * library is `draft`, including the 400+ Likert items in live assessments; an
 * allow list of reviewed states would empty every existing form. These three
 * are the states that only ever get set deliberately, and each one already
 * means the item is withdrawn.
 *
 * Not covered here: an item still marked `piloting` whose standing sign-off was
 * revoked by a later rejection. `cognitive_item_review_gate` refuses to PLACE
 * such an item (20260815100000), but an item placed while approved and rejected
 * afterwards keeps its link, and lifecycle_state alone cannot see that. See the
 * note in that migration.
 */
const WITHDRAWN_LIFECYCLE_STATES = new Set(['suspended', 'retired', 'killed'])

type FormSectionItemRow = {
  item_id: string
  display_order: number
  // Supabase's client isn't given a generated Database type here (see
  // src/lib/supabase/admin.ts), so its select-string parser can't always
  // prove a many-to-one embed is single-valued and may type it as an array.
  // items.id -> assessment_section_items.item_id is many-to-one at runtime
  // (a section item names exactly one item), so this is always a single row
  // in practice — normalizeItem() below unwraps either shape defensively.
  items: FormItemEmbed | FormItemEmbed[]
}

type FormSectionRow = {
  id: string
  item_ordering: string
  assessment_section_items: FormSectionItemRow[] | null
}

function normalizeItem(items: FormItemEmbed | FormItemEmbed[] | undefined): FormItemEmbed {
  if (Array.isArray(items)) return items[0] ?? null
  return items ?? null
}

type RawFormRow = {
  section_id: string
  assembled_at: string
  assembly_seed: string
  assembler_version: string
  form_code: string | null
  entries: unknown
  entry_count: number
}

function mapFormRow(sessionId: string, row: RawFormRow): SectionFormDTO {
  return {
    sessionId,
    sectionId: row.section_id,
    assembledAt: row.assembled_at,
    assemblySeed: row.assembly_seed,
    assemblerVersion: row.assembler_version,
    formCode: row.form_code,
    entries: Array.isArray(row.entries) ? (row.entries as SectionFormEntryDTO[]) : [],
  }
}

const FORM_COLUMNS =
  'section_id, assembled_at, assembly_seed, assembler_version, form_code, entries, entry_count'

// ---------------------------------------------------------------------------
// Campaign factor selection (moved here from session-completeness.ts, which
// used to keep its own copy in sync by hand with getSessionState's — now
// both read through this single implementation via getOrCreateSectionForms).
// ---------------------------------------------------------------------------

async function resolveFactorSelection(
  db: DbClient,
  assessmentId: string,
  campaignId: string | null,
): Promise<
  | { allowedConstructIds: Set<string> | null; itemsPerConstruct: number | null }
  | { error: string }
> {
  if (!campaignId) {
    return { allowedConstructIds: null, itemsPerConstruct: null }
  }

  const { data: campaignAssessment, error: caError } = await db
    .from('campaign_assessments')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('assessment_id', assessmentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (caError) {
    logActionError('sessionForms.campaignAssessment', caError)
    return { error: ERROR_MESSAGE }
  }
  if (!campaignAssessment) {
    return { allowedConstructIds: null, itemsPerConstruct: null }
  }

  const { data: factorRows, error: factorError } = await db
    .from('campaign_assessment_factors')
    .select('factor_id')
    .eq('campaign_assessment_id', campaignAssessment.id)

  if (factorError) {
    logActionError('sessionForms.factorSelection', factorError)
    return { error: ERROR_MESSAGE }
  }
  if (!factorRows || factorRows.length === 0) {
    return { allowedConstructIds: null, itemsPerConstruct: null }
  }

  const selectedFactorIds = new Set(factorRows.map((r) => String(r.factor_id)))

  const { data: assessmentFactors, error: afError } = await db
    .from('assessment_factors')
    .select('factor_id')
    .eq('assessment_id', assessmentId)

  if (afError) {
    logActionError('sessionForms.assessmentFactors', afError)
    return { error: ERROR_MESSAGE }
  }

  const assessmentFactorIds = (assessmentFactors ?? []).map((r) => String(r.factor_id))
  if (assessmentFactorIds.length === 0) {
    return { allowedConstructIds: null, itemsPerConstruct: null }
  }

  const { data: fcLinks, error: fcError } = await db
    .from('factor_constructs')
    .select('construct_id, factor_id')
    .in('factor_id', assessmentFactorIds)

  if (fcError) {
    logActionError('sessionForms.factorConstructs', fcError)
    return { error: ERROR_MESSAGE }
  }
  if (!fcLinks) {
    return { allowedConstructIds: null, itemsPerConstruct: null }
  }

  const allowedConstructIds = new Set(
    fcLinks
      .filter((fc) => selectedFactorIds.has(String(fc.factor_id)))
      .map((fc) => String(fc.construct_id)),
  )

  let itemsPerConstruct: number | null = null
  if (allowedConstructIds.size > 0) {
    const { data: rule, error: ruleError } = await db
      .from('item_selection_rules')
      .select('items_per_construct')
      .lte('min_constructs', allowedConstructIds.size)
      .or(`max_constructs.gte.${allowedConstructIds.size},max_constructs.is.null`)
      .order('display_order', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (ruleError) {
      logActionError('sessionForms.selectionRules', ruleError)
      return { error: ERROR_MESSAGE }
    }
    itemsPerConstruct = rule ? Number(rule.items_per_construct) : null
  }

  return { allowedConstructIds, itemsPerConstruct }
}

// ---------------------------------------------------------------------------
// Assembly — the same filter -> per-construct cap -> ordering pipeline that
// used to live inline in getSessionState.
// ---------------------------------------------------------------------------

function entryFor(
  itemId: string,
  item: FormItemEmbed,
  position: number,
): SectionFormEntryDTO {
  const purpose = item?.purpose ?? 'construct'
  return {
    position,
    itemId,
    itemVersion: item?.item_version ?? 1,
    contentHash: item?.content_hash ?? null,
    purpose,
    // Practice/seed items are delivered (and required by the completeness
    // gate — doc 02-platform-architecture.md §5.3) but never count toward a
    // scoring aggregate.
    countsTowardScore: purpose !== 'practice' && purpose !== 'seed',
  }
}

/** A section item with its embedded item row normalised to a single object
 *  (see normalizeItem) and construct_id hoisted to the top level, up front —
 *  so every downstream step (filter, cap, order, entry-building) works
 *  against one unambiguous shape instead of re-normalising `items` at every
 *  call site. `construct_id` at the top level is also what satisfies
 *  applyItemOrdering's ConstructBearing constraint. */
type WorkingSectionItem = {
  itemId: string
  displayOrder: number
  constructId: string | null
  item: FormItemEmbed
}

function toWorkingItem(si: FormSectionItemRow): WorkingSectionItem {
  const item = normalizeItem(si.items)
  return {
    itemId: item?.id ?? si.item_id,
    displayOrder: si.display_order,
    constructId: item?.construct_id ?? null,
    item,
  }
}

function assembleEntries(
  section: FormSectionRow,
  selection: { allowedConstructIds: Set<string> | null; itemsPerConstruct: number | null },
  sessionId: string,
  priorAnsweredItemIds: Set<string>,
): SectionFormEntryDTO[] {
  let sectionItems = (section.assessment_section_items ?? [])
    .map(toWorkingItem)
    // Before anything else: a withdrawn item is not served, even though the
    // section still links it. Applied ahead of the factor filter and the
    // per-construct cap so a withdrawn item never occupies one of the slots.
    .filter((si) => !(si.item?.lifecycle_state && WITHDRAWN_LIFECYCLE_STATES.has(si.item.lifecycle_state)))
    .sort((a, b) => a.displayOrder - b.displayOrder)

  if (selection.allowedConstructIds) {
    const allowed = selection.allowedConstructIds

    // Always include non-construct items (attention checks, impression
    // management, infrequency, and — per 20260813100500 — practice/seed
    // items, which keep a construct_id but are never factor-gated).
    sectionItems = sectionItems.filter((si) => {
      const purpose = si.item?.purpose
      if (purpose && purpose !== 'construct') return true
      return Boolean(si.constructId && allowed.has(si.constructId))
    })

    if (selection.itemsPerConstruct !== null) {
      const constructItems = sectionItems.filter(
        (si) => (!si.item?.purpose || si.item.purpose === 'construct') && si.constructId,
      )
      const nonConstructItems = sectionItems.filter(
        (si) => si.item?.purpose && si.item.purpose !== 'construct',
      )

      const byConstruct = new Map<string, typeof constructItems>()
      for (const si of constructItems) {
        const key = si.constructId ?? ''
        const group = byConstruct.get(key)
        if (group) group.push(si)
        else byConstruct.set(key, [si])
      }

      const keptConstructItems: typeof constructItems = []
      for (const [, group] of byConstruct) {
        const wrapped = group.map((si) => ({
          si,
          difficulty: si.item?.difficulty ?? 'medium',
          reverseScored: si.item?.reverse_scored ?? false,
          displayOrder: si.displayOrder,
        }))
        const picked = selectItemsByDifficulty(wrapped, selection.itemsPerConstruct)
        keptConstructItems.push(...picked.map((p) => p.si))
      }

      sectionItems = [...nonConstructItems, ...keptConstructItems].sort(
        (a, b) => a.displayOrder - b.displayOrder,
      )
    }
  }

  sectionItems = applyItemOrdering(
    sectionItems.map((si) => ({ ...si, construct_id: si.constructId })),
    section.item_ordering as ItemOrdering,
    `${sessionId}:${section.id}`,
  )

  const entries: SectionFormEntryDTO[] = sectionItems.map((si, i) =>
    entryFor(si.itemId, si.item, i + 1),
  )

  // In-flight-at-deploy compatibility (see migration header): never let a
  // fresh computation silently drop an item this session already answered
  // in this section. Anything already answered but missing from the fresh
  // set is appended, so an existing response can never fall outside the
  // frozen "delivered" set the completeness gate reads.
  const includedIds = new Set(entries.map((e) => e.itemId))
  const stillMissing = [...priorAnsweredItemIds].filter((id) => !includedIds.has(id))
  if (stillMissing.length > 0) {
    const byItemId = new Map<string, FormItemEmbed>()
    for (const si of section.assessment_section_items ?? []) {
      byItemId.set(si.item_id, normalizeItem(si.items))
    }
    let position = entries.length
    for (const itemId of stillMissing) {
      position += 1
      entries.push(entryFor(itemId, byItemId.get(itemId) ?? null, position))
    }
  }

  return entries
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Returns the frozen form for every section of `assessmentId`, assembling
 * (and persisting) any that don't exist yet for this session. Called by
 * getSessionState (every section, on every read of the runner) and by
 * getSessionCompleteness (as a fallback so the completeness gate can never
 * observe a section neither call site has frozen yet — see that module).
 *
 * Idempotent and race-safe: assembly is a pure function of stable inputs
 * (item bank + campaign factor selection at the moment of the FIRST
 * successful freeze), and the write is `ON CONFLICT (session_id,
 * section_id) DO NOTHING` (via `ignoreDuplicates`), so two concurrent
 * requests — two tabs, a retry — converge on one row without racing.
 */
export async function getOrCreateSectionForms(
  db: DbClient,
  input: { sessionId: string; assessmentId: string; campaignId: string | null },
): Promise<Map<string, SectionFormDTO> | { error: string }> {
  const { sessionId, assessmentId, campaignId } = input

  const [existingResult, sectionsResult, selection] = await Promise.all([
    db.from('participant_section_forms').select(FORM_COLUMNS).eq('session_id', sessionId),
    db
      .from('assessment_sections')
      .select(
        `
        id, item_ordering,
        assessment_section_items(
          item_id, display_order,
          items(id, construct_id, purpose, difficulty, reverse_scored, item_version, content_hash, lifecycle_state)
        )
      `,
      )
      .eq('assessment_id', assessmentId),
    resolveFactorSelection(db, assessmentId, campaignId),
  ])

  if (existingResult.error) {
    logActionError('sessionForms.existing', existingResult.error)
    return { error: ERROR_MESSAGE }
  }
  if (sectionsResult.error) {
    logActionError('sessionForms.sections', sectionsResult.error)
    return { error: ERROR_MESSAGE }
  }
  if ('error' in selection) return selection

  const forms = new Map<string, SectionFormDTO>()
  for (const row of (existingResult.data ?? []) as RawFormRow[]) {
    forms.set(row.section_id, mapFormRow(sessionId, row))
  }

  // See the FormSectionItemRow comment above: without a generated Database
  // type on this client, the select-string parser can't prove the `items`
  // embed is single-valued, so its structural inference doesn't reliably
  // overlap with our (runtime-accurate) row type — hence the `unknown` hop.
  const sectionRows = (sectionsResult.data ?? []) as unknown as FormSectionRow[]
  const missingSections = sectionRows.filter((s) => !forms.has(s.id))
  if (missingSections.length === 0) return forms

  const missingSectionIds = missingSections.map((s) => s.id)

  // In-flight-at-deploy input: items already answered, in these sections,
  // for this session — see assembleEntries.
  const { data: responseRows, error: responsesError } = await db
    .from('participant_responses')
    .select('item_id, section_id')
    .eq('session_id', sessionId)
    .in('section_id', missingSectionIds)

  if (responsesError) {
    logActionError('sessionForms.priorResponses', responsesError)
    return { error: ERROR_MESSAGE }
  }

  const answeredBySection = new Map<string, Set<string>>()
  for (const row of responseRows ?? []) {
    const sid = row.section_id as string | null
    if (!sid) continue
    const set = answeredBySection.get(sid) ?? new Set<string>()
    set.add(row.item_id as string)
    answeredBySection.set(sid, set)
  }

  const toInsert: Record<string, unknown>[] = []
  for (const section of missingSections) {
    const entries = assembleEntries(
      section,
      selection,
      sessionId,
      answeredBySection.get(section.id) ?? new Set(),
    )
    // No items delivered to this section (e.g. an instructions-only section,
    // or every item filtered out) — nothing to freeze, matches the existing
    // "sections with zero items are dropped" behaviour downstream.
    if (entries.length === 0) continue
    toInsert.push({
      session_id: sessionId,
      section_id: section.id,
      assembly_seed: `${sessionId}:${section.id}`,
      assembler_version: ASSEMBLER_VERSION,
      entries,
      entry_count: entries.length,
    })
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await db
      .from('participant_section_forms')
      .upsert(toInsert, { onConflict: 'session_id,section_id', ignoreDuplicates: true })

    if (insertError) {
      logActionError('sessionForms.insert', insertError)
      return { error: ERROR_MESSAGE }
    }

    // Re-select rather than trust our own `toInsert` values: with
    // ignoreDuplicates, a row we lost the race on isn't returned by the
    // upsert call, and PostgREST doesn't return DO-NOTHING-skipped rows
    // either — this fetch is what makes concurrent callers converge on
    // whichever row actually won.
    const { data: freshRows, error: freshError } = await db
      .from('participant_section_forms')
      .select(FORM_COLUMNS)
      .eq('session_id', sessionId)
      .in('section_id', missingSectionIds)

    if (freshError) {
      logActionError('sessionForms.reselect', freshError)
      return { error: ERROR_MESSAGE }
    }
    for (const row of (freshRows ?? []) as RawFormRow[]) {
      forms.set(row.section_id, mapFormRow(sessionId, row))
    }
  }

  return forms
}
