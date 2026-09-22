/**
 * Architect matching pipeline — eligibility filter + rank + item counts.
 *
 * Extracted out of the admin-only `runArchitectMatch` Server Action
 * (src/app/actions/architect.ts) so the public Role Builder
 * (src/app/actions/public-builds.ts, gated by its own signed-cookie + rate
 * limits, never by requireAdminScope) can reuse the exact same pipeline
 * without importing anything from a `'use server'` module — every export of
 * a `'use server'` file is a directly callable RPC endpoint, so the shared
 * logic has to live outside one. See "Server side" in
 * docs/superpowers/specs/2026-09-17-public-role-builder-design.md.
 *
 * Uses the admin client rather than the RLS-respecting server client: factors
 * and library_categories are platform-wide reference data (not in any
 * tenant table), so this is a no-op for an authenticated admin and the only
 * way an unauthenticated public caller can read them at all.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { throwActionError } from '@/lib/security/action-errors'
import { runMatching } from '@/lib/ai/matching/engine'
import type { Brief, MatchingFactor } from '@/types/ai'
import type { ArchitectPick, ArchitectMatchResult } from '@/types/architect'

export interface ArchitectMatchOptions {
  /** Exclude cognitive-format items from every item count (public builds never expose the cognitive bank). */
  excludeCognitive?: boolean
  /** Cap `availableItems` at this count — public builds deliver a fixed count per factor regardless of true pool size. */
  itemsPerFactor?: number
  /**
   * The raw position description the brief came from, when the caller still
   * holds it. The Jev engine judges from this in preference to the brief;
   * the LLM engine ignores it.
   */
  rawText?: string
}

/** Same cap as `extractBrief` — a PD longer than this is padding, not signal. */
const RAW_TEXT_LIMIT = 40_000

export interface ArchitectMatchUsage {
  inputTokens: number
  outputTokens: number
  reasoningTokens?: number
}

export type ArchitectMatchResultWithUsage = ArchitectMatchResult & { usage: ArchitectMatchUsage }

type DbClient = ReturnType<typeof createAdminClient>

export async function runArchitectMatchPipeline(
  brief: Brief,
  options: ArchitectMatchOptions = {},
): Promise<ArchitectMatchResultWithUsage> {
  const db = createAdminClient()

  // Eligible factor pool: match-eligible, active, not deleted.
  const { data: factorRows, error } = await db
    .from('factors')
    .select('id, name, definition, description, indicators_low, indicators_mid, indicators_high, applicable_outcomes, applicable_levels, applicable_functions, dimension_id, dimensions(name), primary_category_id')
    .eq('is_active', true)
    .eq('is_match_eligible', true)
    .is('deleted_at', null)

  if (error) {
    throwActionError('runArchitectMatchPipeline.factors', 'Unable to load the factor library.', error)
  }

  // Outcome eligibility is hard for both engines. LEVEL is not: the Jev engine
  // treats it as a soft penalty, so the whole outcome-eligible pool is offered
  // to the matcher and `runMatching` re-applies the hard level filter itself on
  // the LLM path. `eligibleFactors`/`consideredCount` keep their old meaning
  // (the outcome- AND level-filtered pool) because they drive the "add a
  // factor" control — a pick promoted from outside that pool is still valid.
  const outcomeEligible = (factorRows ?? []).filter((f) => {
    const outcomes = (f.applicable_outcomes ?? []) as string[]
    return outcomes.length === 0 || outcomes.includes(brief.outcome)
  })
  const levelEligible = outcomeEligible.filter((f) => {
    const levels = (f.applicable_levels ?? []) as string[]
    return levels.length === 0 || levels.includes(brief.level)
  })

  const dimNameOf = (row: Record<string, unknown>): string | null => {
    const d = row.dimensions
    if (Array.isArray(d)) return (d[0] as { name?: string } | undefined)?.name ?? null
    return (d as { name?: string } | null)?.name ?? null
  }

  const { data: catRows } = await db
    .from('library_categories')
    .select('id, key, name')
    .order('display_order', { ascending: true })
  const catById = new Map(
    (catRows ?? []).map((c) => [c.id as string, { key: c.key as string, name: c.name as string }]),
  )
  const categories = (catRows ?? []).map((c) => ({ key: c.key as string, name: c.name as string }))
  const catOf = (f?: Record<string, unknown>) => {
    const id = (f?.primary_category_id as string | null) ?? null
    const cat = id ? catById.get(id) : undefined
    return { categoryId: id, categoryName: cat?.name ?? null, categoryKey: cat?.key ?? null }
  }

  if (outcomeEligible.length === 0) {
    return {
      picks: [],
      summary: 'No eligible factors matched this brief.',
      recommendedCount: { minimum: 0, optimal: 0, maximum: 0 },
      consideredCount: 0,
      eligibleFactors: [],
      categories,
      usage: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
    }
  }

  const availableFactors: MatchingFactor[] = outcomeEligible.map((f) => ({
    id: f.id as string,
    name: f.name as string,
    definition: ((f.definition as string) || (f.description as string) || '').trim(),
    applicableFunctions: (f.applicable_functions ?? []) as string[],
    applicableLevels: (f.applicable_levels ?? []) as string[],
    applicableOutcomes: (f.applicable_outcomes ?? []) as string[],
    indicatorsHigh: ((f.indicators_high as string | null) ?? undefined) || undefined,
    indicatorsLow: ((f.indicators_low as string | null) ?? undefined) || undefined,
    category: catOf(f as Record<string, unknown>).categoryName ?? undefined,
  }))

  const itemCountByFactor = await getItemCountsByFactor(
    db,
    availableFactors.map((f) => f.id),
    options,
  )

  const rawText = options.rawText?.trim().slice(0, RAW_TEXT_LIMIT) || undefined

  let output
  try {
    output = await runMatching({ source: { kind: 'brief', brief, rawText }, availableFactors })
  } catch (matchError) {
    throwActionError('runArchitectMatchPipeline.match', 'The matcher could not rank factors for this brief.', matchError)
  }

  const eligibleById = new Map(
    outcomeEligible.map((f) => [f.id as string, f as Record<string, unknown>]),
  )

  const picks: ArchitectPick[] = output.rankings.map((r) => {
    const f = eligibleById.get(r.factorId)
    return {
      factorId: r.factorId,
      factorName: r.factorName,
      rank: r.rank,
      relevanceScore: r.relevanceScore,
      reasoning: r.reasoning,
      availableItems: itemCountByFactor.get(r.factorId) ?? 0,
      dimensionId: (f?.dimension_id as string | null) ?? null,
      dimensionName: f ? dimNameOf(f) : null,
      definition: ((f?.definition as string) || (f?.description as string)) ?? null,
      indicatorsLow: (f?.indicators_low as string | null) ?? null,
      indicatorsMid: (f?.indicators_mid as string | null) ?? null,
      indicatorsHigh: (f?.indicators_high as string | null) ?? null,
      ...catOf(f),
    }
  })

  const eligibleFactors = levelEligible.map((f) => ({
    factorId: f.id as string,
    factorName: f.name as string,
    availableItems: itemCountByFactor.get(f.id as string) ?? 0,
    dimensionId: (f.dimension_id as string | null) ?? null,
    dimensionName: dimNameOf(f as Record<string, unknown>),
    definition: ((f.definition as string) || (f.description as string)) ?? null,
    indicatorsLow: (f.indicators_low as string | null) ?? null,
    indicatorsMid: (f.indicators_mid as string | null) ?? null,
    indicatorsHigh: (f.indicators_high as string | null) ?? null,
    ...catOf(f as Record<string, unknown>),
  }))

  return {
    picks,
    summary: output.summary,
    recommendedCount: output.recommendedCount,
    consideredCount: levelEligible.length,
    eligibleFactors,
    categories,
    usage: output.usage ?? { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
    ...(output.engine ? { engine: output.engine } : {}),
    ...(output.resolvedLevel ? { resolvedLevel: output.resolvedLevel } : {}),
  }
}

async function getItemCountsByFactor(
  db: DbClient,
  factorIds: string[],
  options: ArchitectMatchOptions,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (factorIds.length === 0) return counts

  const { data: links } = await db
    .from('factor_constructs')
    .select('factor_id, construct_id')
    .in('factor_id', factorIds)

  const constructIds = [...new Set((links ?? []).map((l) => l.construct_id as string))]
  if (constructIds.length === 0) return counts

  const itemsQuery = options.excludeCognitive
    ? db
        .from('items')
        .select('construct_id, response_formats!inner(type)')
        .eq('status', 'active')
        .is('deleted_at', null)
        .in('construct_id', constructIds)
        .neq('response_formats.type', 'cognitive')
    : db
        .from('items')
        .select('construct_id')
        .eq('status', 'active')
        .is('deleted_at', null)
        .in('construct_id', constructIds)

  const { data: items } = await itemsQuery

  const itemsByConstruct = new Map<string, number>()
  for (const it of (items ?? []) as Array<{ construct_id: string }>) {
    const cid = it.construct_id
    itemsByConstruct.set(cid, (itemsByConstruct.get(cid) ?? 0) + 1)
  }

  for (const link of links ?? []) {
    const fid = link.factor_id as string
    const cid = link.construct_id as string
    const raw = (itemsByConstruct.get(cid) ?? 0) + (counts.get(fid) ?? 0)
    counts.set(fid, options.itemsPerFactor ? Math.min(raw, options.itemsPerFactor) : raw)
  }
  return counts
}
