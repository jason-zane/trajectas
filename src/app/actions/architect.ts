'use server'

/**
 * Assessment Architect — server actions.
 *
 * The fast lane: a role brief in, a bespoke draft assessment out. Three stages,
 * each its own action so the wizard can show intermediate state:
 *   1. extractBrief         — role text + decision  -> structured Brief
 *   2. runArchitectMatch    — Brief -> ranked, eligibility-filtered factors
 *   3. createArchitectAssessment — chosen factors -> draft assessment
 *
 * v1 takes pasted/typed role text only; file ingestion (PDF/DOCX) is a
 * fast-follow that slots in ahead of extractBrief by producing `rawText`.
 * Architect runs are not persisted to matching_runs for v1 — the durable
 * artifact is the created assessment.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAdminScope } from '@/lib/auth/authorization'
import { throwActionError } from '@/lib/security/action-errors'
import { runBriefExtraction } from '@/lib/ai/brief-extraction'
import { runMatching } from '@/lib/ai/matching/engine'
import { createAssessment } from '@/app/actions/assessments'
import { extractBriefSchema, runArchitectMatchSchema, createArchitectAssessmentSchema } from '@/lib/validations/architect'
import type { Brief, MatchingFactor } from '@/types/ai'
import type { ArchitectPick, ArchitectMatchResult } from '@/types/architect'

// ---------------------------------------------------------------------------
// Stage 1 — brief extraction
// ---------------------------------------------------------------------------

export async function extractBrief(input: {
  rawText: string
  outcomeIntent: string
}): Promise<Brief> {
  await requireAdminScope()
  const parsed = extractBriefSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error('Please provide a longer role description.')
  }
  try {
    return await runBriefExtraction(parsed.data)
  } catch (error) {
    throwActionError('extractBrief', 'Unable to read the role description.', error)
  }
}

// ---------------------------------------------------------------------------
// Stage 2 — eligibility filter + rank
// ---------------------------------------------------------------------------

export async function runArchitectMatch(input: { brief: Brief }): Promise<ArchitectMatchResult> {
  await requireAdminScope()
  const parsed = runArchitectMatchSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error('Invalid brief.')
  }
  const brief = parsed.data.brief as Brief
  const db = await createClient()

  // Eligible factor pool: match-eligible, active, not deleted.
  const { data: factorRows, error } = await db
    .from('factors')
    .select('id, name, definition, description, applicable_outcomes, applicable_levels')
    .eq('is_active', true)
    .eq('is_match_eligible', true)
    .is('deleted_at', null)

  if (error) {
    throwActionError('runArchitectMatch.factors', 'Unable to load the factor library.', error)
  }

  // Eligibility filter: empty tag arrays mean "applies to all" (pre-backfill).
  const eligible = (factorRows ?? []).filter((f) => {
    const outcomes = (f.applicable_outcomes ?? []) as string[]
    const levels = (f.applicable_levels ?? []) as string[]
    const outcomeOk = outcomes.length === 0 || outcomes.includes(brief.outcome)
    const levelOk = levels.length === 0 || levels.includes(brief.level)
    return outcomeOk && levelOk
  })

  if (eligible.length === 0) {
    return { picks: [], summary: 'No eligible factors matched this brief.', recommendedCount: { minimum: 0, optimal: 0, maximum: 0 }, consideredCount: 0 }
  }

  const availableFactors: MatchingFactor[] = eligible.map((f) => ({
    id: f.id as string,
    name: f.name as string,
    // Feed definition; fall back to description (definition is the populated field).
    definition: ((f.definition as string) || (f.description as string) || '').trim(),
  }))

  // Item counts per factor (factor_constructs -> items), for the picks counters.
  const itemCountByFactor = await getItemCountsByFactor(db, availableFactors.map((f) => f.id))

  let output
  try {
    output = await runMatching({ source: { kind: 'brief', brief }, availableFactors })
  } catch (error) {
    throwActionError('runArchitectMatch.match', 'The matcher could not rank factors for this brief.', error)
  }

  const picks: ArchitectPick[] = output.rankings.map((r) => ({
    factorId: r.factorId,
    factorName: r.factorName,
    rank: r.rank,
    relevanceScore: r.relevanceScore,
    reasoning: r.reasoning,
    availableItems: itemCountByFactor.get(r.factorId) ?? 0,
  }))

  return {
    picks,
    summary: output.summary,
    recommendedCount: output.recommendedCount,
    consideredCount: eligible.length,
  }
}

// ---------------------------------------------------------------------------
// Stage 3 — assemble + save
// ---------------------------------------------------------------------------

export async function createArchitectAssessment(input: {
  title: string
  description?: string
  picks: Array<{ factorId: string; itemCount: number; weight?: number }>
}) {
  const parsed = createArchitectAssessmentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // Reuse the existing assessment-creation path; it enforces its own scope.
  return createAssessment({
    title: parsed.data.title,
    description: parsed.data.description,
    status: 'draft',
    itemSelectionStrategy: 'fixed',
    creationMode: 'ai_generated',
    formatMode: 'traditional',
    factors: parsed.data.picks.map((p) => ({
      factorId: p.factorId,
      weight: p.weight ?? 1,
      itemCount: p.itemCount,
    })),
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DbClient = Awaited<ReturnType<typeof createClient>>

async function getItemCountsByFactor(
  db: DbClient,
  factorIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (factorIds.length === 0) return counts

  const { data: links } = await db
    .from('factor_constructs')
    .select('factor_id, construct_id')
    .in('factor_id', factorIds)

  const constructIds = [...new Set((links ?? []).map((l) => l.construct_id as string))]
  if (constructIds.length === 0) return counts

  const { data: items } = await db
    .from('items')
    .select('construct_id')
    .eq('status', 'active')
    .is('deleted_at', null)
    .in('construct_id', constructIds)

  const itemsByConstruct = new Map<string, number>()
  for (const it of items ?? []) {
    const cid = it.construct_id as string
    itemsByConstruct.set(cid, (itemsByConstruct.get(cid) ?? 0) + 1)
  }

  for (const link of links ?? []) {
    const fid = link.factor_id as string
    const cid = link.construct_id as string
    counts.set(fid, (counts.get(fid) ?? 0) + (itemsByConstruct.get(cid) ?? 0))
  }
  return counts
}
