import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { logActionError } from '@/lib/security/action-errors'
import { selectItemsByDifficulty } from '@/lib/item-selection/distribution'
import type { ItemDifficulty } from '@/types/database'

type DbClient = SupabaseClient

/**
 * Compare the item set actually DELIVERED to this session against its saved
 * responses. Backs the hard completeness gate in submitSession: an
 * in-progress session may only be completed once every delivered item has a
 * response.
 *
 * "Delivered" mirrors the runner's selection pipeline in getSessionState:
 * when the campaign has a factor selection (campaign_assessment_factors),
 * construct items are filtered to the selected factors' constructs and
 * capped per construct via the item-selection rules + selectItemsByDifficulty
 * (both deterministic — the runner recomputes them on every page load, so
 * they must be). Non-construct items (attention checks, impression
 * management, infrequency) are always delivered. Without a factor selection,
 * every item in the assessment counts.
 *
 * Only delivered items count on either side — stale responses to removed or
 * unselected items neither help nor hurt.
 */
export async function getSessionCompleteness(
  db: DbClient,
  input: {
    sessionId: string
    assessmentId: string | null
    campaignId: string | null
  },
): Promise<{ expected: number; answered: number } | { error: string }> {
  const { sessionId, assessmentId, campaignId } = input
  if (!assessmentId) {
    return { error: 'Unable to verify assessment completeness right now' }
  }

  const [itemsResult, responsesResult] = await Promise.all([
    db
      .from('assessment_section_items')
      .select(
        'item_id, section_id, display_order, assessment_sections!inner(assessment_id), items(purpose, construct_id, difficulty, reverse_scored)',
      )
      .eq('assessment_sections.assessment_id', assessmentId),
    db
      .from('participant_responses')
      .select('item_id')
      .eq('session_id', sessionId),
  ])

  if (itemsResult.error) {
    logActionError('sessionCompleteness.items', itemsResult.error)
    return { error: 'Unable to verify assessment completeness right now' }
  }
  if (responsesResult.error) {
    logActionError('sessionCompleteness.responses', responsesResult.error)
    return { error: 'Unable to verify assessment completeness right now' }
  }

  type ItemEmbed = {
    purpose: string | null
    construct_id: string | null
    difficulty: ItemDifficulty | null
    reverse_scored: boolean | null
  } | null
  type SectionItemRow = {
    item_id: string
    section_id: string
    display_order: number
    items: ItemEmbed | ItemEmbed[]
  }

  const rows = ((itemsResult.data ?? []) as unknown as SectionItemRow[]).map(
    (row) => ({
      itemId: String(row.item_id),
      sectionId: String(row.section_id),
      displayOrder: Number(row.display_order ?? 0),
      item: Array.isArray(row.items) ? (row.items[0] ?? null) : row.items,
    }),
  )

  const selection = await resolveFactorSelection(db, assessmentId, campaignId)
  if ('error' in selection) return { error: selection.error }

  const expectedIds = new Set<string>()
  if (!selection.allowedConstructIds) {
    for (const row of rows) expectedIds.add(row.itemId)
  } else {
    const allowed = selection.allowedConstructIds
    // Mirror the runner: group per section, filter, then cap per construct.
    const bySection = new Map<string, typeof rows>()
    for (const row of rows) {
      const group = bySection.get(row.sectionId)
      if (group) group.push(row)
      else bySection.set(row.sectionId, [row])
    }

    for (const sectionRows of bySection.values()) {
      const delivered = sectionRows
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .filter((row) => {
          if (row.item?.purpose && row.item.purpose !== 'construct') return true
          return Boolean(row.item?.construct_id && allowed.has(row.item.construct_id))
        })

      if (selection.itemsPerConstruct === null) {
        for (const row of delivered) expectedIds.add(row.itemId)
        continue
      }

      const constructRows = delivered.filter(
        (row) =>
          (!row.item?.purpose || row.item.purpose === 'construct') &&
          row.item?.construct_id,
      )
      const nonConstructRows = delivered.filter(
        (row) => row.item?.purpose && row.item.purpose !== 'construct',
      )

      const byConstruct = new Map<string, typeof constructRows>()
      for (const row of constructRows) {
        const key = row.item?.construct_id ?? ''
        const group = byConstruct.get(key)
        if (group) group.push(row)
        else byConstruct.set(key, [row])
      }

      for (const row of nonConstructRows) expectedIds.add(row.itemId)
      for (const group of byConstruct.values()) {
        const wrapped = group.map((row) => ({
          row,
          difficulty: row.item?.difficulty ?? 'medium',
          reverseScored: row.item?.reverse_scored ?? false,
          displayOrder: row.displayOrder,
        }))
        const picked = selectItemsByDifficulty(wrapped, selection.itemsPerConstruct)
        for (const p of picked) expectedIds.add(p.row.itemId)
      }
    }
  }

  const answeredIds = new Set(
    (responsesResult.data ?? []).map((row) => String(row.item_id)),
  )
  let answered = 0
  for (const id of expectedIds) {
    if (answeredIds.has(id)) answered++
  }
  return { expected: expectedIds.size, answered }
}

/**
 * Resolve the campaign's factor selection for this assessment, mirroring
 * getSessionState: selected factors → their constructs (via the assessment's
 * own factor links) → per-construct item cap from item_selection_rules.
 * Returns allowedConstructIds null when the campaign has no selection.
 */
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
    logActionError('sessionCompleteness.campaignAssessment', caError)
    return { error: 'Unable to verify assessment completeness right now' }
  }
  if (!campaignAssessment) {
    return { allowedConstructIds: null, itemsPerConstruct: null }
  }

  const { data: factorRows, error: factorError } = await db
    .from('campaign_assessment_factors')
    .select('factor_id')
    .eq('campaign_assessment_id', campaignAssessment.id)

  if (factorError) {
    logActionError('sessionCompleteness.factorSelection', factorError)
    return { error: 'Unable to verify assessment completeness right now' }
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
    logActionError('sessionCompleteness.assessmentFactors', afError)
    return { error: 'Unable to verify assessment completeness right now' }
  }

  const assessmentFactorIds = (assessmentFactors ?? []).map((r) =>
    String(r.factor_id),
  )
  if (assessmentFactorIds.length === 0) {
    return { allowedConstructIds: null, itemsPerConstruct: null }
  }

  const { data: fcLinks, error: fcError } = await db
    .from('factor_constructs')
    .select('construct_id, factor_id')
    .in('factor_id', assessmentFactorIds)

  if (fcError) {
    logActionError('sessionCompleteness.factorConstructs', fcError)
    return { error: 'Unable to verify assessment completeness right now' }
  }
  if (!fcLinks) {
    return { allowedConstructIds: null, itemsPerConstruct: null }
  }

  const allowedConstructIds = new Set(
    fcLinks
      .filter((fc) => selectedFactorIds.has(String(fc.factor_id)))
      .map((fc) => String(fc.construct_id)),
  )

  // Same rule lookup as getItemsPerConstructForCount, inlined so the DAL
  // does not depend on a server action module.
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
      logActionError('sessionCompleteness.selectionRules', ruleError)
      return { error: 'Unable to verify assessment completeness right now' }
    }
    itemsPerConstruct = rule ? Number(rule.items_per_construct) : null
  }

  return { allowedConstructIds, itemsPerConstruct }
}
